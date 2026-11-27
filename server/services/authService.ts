import crypto from 'node:crypto';
import { getDb, mapUser, newId, nowIso, writeAuditLog, type UserRow } from '../database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { User, UserRole } from '../types.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'talentiq_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function hashToken(token: string): string {
  const secret = process.env.AUTH_SECRET || 'talentiq-local-session-pepper';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  getDb()
    .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(newId(), userId, tokenHash, expiresAt, nowIso());
  return { token, expiresAt };
}

export function verifySessionToken(token: string): User | null {
  if (!token || token.length < 16) return null;
  const tokenHash = hashToken(token);
  const row = getDb()
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash) as (UserRow & { session_expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.session_expires_at).getTime() <= Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return mapUser(row);
}

export function revokeSession(token: string): void {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function ensureCandidateProfileForUser(user: User): string {
  const database = getDb();
  const byUser = database.prepare('SELECT id FROM candidates WHERE user_id = ?').get(user.id) as { id: string } | undefined;
  if (byUser) return byUser.id;

  const byEmail = database
    .prepare('SELECT id, user_id FROM candidates WHERE lower(email) = ?')
    .get(user.email.toLowerCase()) as { id: string; user_id: string | null } | undefined;

  if (byEmail) {
    if (!byEmail.user_id) {
      database.prepare('UPDATE candidates SET user_id = ?, updated_at = ? WHERE id = ?').run(user.id, nowIso(), byEmail.id);
    }
    return byEmail.id;
  }

  const candidateId = newId();
  const ts = nowIso();
  database
    .prepare(
      `INSERT INTO candidates (id, user_id, name, email, phone, skills, education, experience, projects, certifications, portfolio_links, preferences, years_experience, resume_text, stage, source, is_sample, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', '[]', '[]', '{}', 0, '', 'new', 'candidate_portal', ?, ?, ?)`,
    )
    .run(candidateId, user.id, user.fullName, user.email.toLowerCase(), user.phone, user.isDemo ? 1 : 0, ts, ts);
  return candidateId;
}

export function registerUser(input: {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  company?: string;
}): { user: User; token: string; expiresAt: string } {
  const database = getDb();
  const email = input.email.trim().toLowerCase();
  const existing = database.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as { id: string } | undefined;
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  }

  const id = newId();
  const ts = nowIso();
  const passwordHash = hashPassword(input.password);
  database
    .prepare(
      `INSERT INTO users (id, email, password_hash, role, full_name, phone, company, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      id,
      email,
      passwordHash,
      input.role,
      input.fullName.trim(),
      input.phone?.trim() || null,
      input.role === 'recruiter' ? input.company?.trim() || null : null,
      ts,
      ts,
    );

  const row = database.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
  const user = mapUser(row);
  if (user.role === 'candidate') {
    ensureCandidateProfileForUser(user);
  }
  const session = createSession(user.id);
  writeAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'user_registered',
    targetType: 'user',
    targetId: user.id,
    details: { role: user.role },
  });
  return { user, ...session };
}

export function authenticateUser(emailInput: string, password: string): { user: User; token: string; expiresAt: string } {
  const email = emailInput.trim().toLowerCase();
  const row = getDb().prepare('SELECT * FROM users WHERE lower(email) = ?').get(email) as unknown as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  const user = mapUser(row);
  if (user.role === 'candidate') {
    ensureCandidateProfileForUser(user);
  }
  const session = createSession(user.id);
  writeAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'user_logged_in',
    targetType: 'user',
    targetId: user.id,
  });
  return { user, ...session };
}

export function requestPasswordReset(emailInput: string): {
  accepted: boolean;
  emailConfigured: boolean;
  previewToken?: string;
} {
  const email = emailInput.trim().toLowerCase();
  const row = getDb().prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as { id: string } | undefined;
  const emailConfigured = Boolean(process.env.SMTP_HOST?.trim());
  if (!row) {
    return { accepted: true, emailConfigured };
  }
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  getDb()
    .prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
    .run(newId(), row.id, tokenHash, expiresAt, nowIso());
  writeAuditLog({
    actorUserId: row.id,
    action: 'password_reset_requested',
    targetType: 'user',
    targetId: row.id,
  });
  return {
    accepted: true,
    emailConfigured,
    // Never expose reset token in production; only return locally in non-production test/dev when SMTP is absent.
    ...(process.env.NODE_ENV === 'test' ? { previewToken: token } : {}),
  };
}

export function completePasswordReset(token: string, newPassword: string): void {
  const database = getDb();
  const tokenHash = hashToken(token.trim());
  const row = database
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?')
    .get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has expired.');
  }
  const ts = nowIso();
  database.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(newPassword), ts, row.user_id);
  database.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(ts, row.id);
  database.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  writeAuditLog({
    actorUserId: row.user_id,
    action: 'password_reset_completed',
    targetType: 'user',
    targetId: row.user_id,
  });
}
