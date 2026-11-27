import { Router, type Response } from 'express';
import { getDb, mapUser, newId, nowIso, type UserRow } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { rateLimit, requireAuth } from '../middleware/auth.js';
import {
  authenticateUser,
  completePasswordReset,
  createSession,
  ensureCandidateProfileForUser,
  hashPassword,
  registerUser,
  requestPasswordReset,
  revokeSession,
  SESSION_COOKIE_NAME,
} from '../services/authService.js';
import { getActiveSubscription } from '../services/paymentService.js';
import { seedDemoData } from '../seed.js';
import {
  demoLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validation.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyPrefix: 'auth' });

function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    expires: new Date(expiresAt),
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, token, expiresAt } = registerUser(input);
    setSessionCookie(res, token, expiresAt);
    res.status(201).json({ user, expiresAt });
  }),
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, token, expiresAt } = authenticateUser(input.email, input.password);
    setSessionCookie(res, token, expiresAt);
    res.json({ user, expiresAt });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionToken) {
      revokeSession(req.sessionToken);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === 'recruiter') {
      const subscription = getActiveSubscription(user.id);
      res.json({ user, subscription });
      return;
    }
    const candidateId = ensureCandidateProfileForUser(user);
    res.json({ user, candidateId });
  }),
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = requestPasswordReset(email);
    res.json({
      message: result.emailConfigured
        ? 'If an account exists for that email, a password reset link has been sent.'
        : 'Password reset recorded. Email delivery (SMTP) is not configured in this local environment.',
      emailConfigured: result.emailConfigured,
      ...(result.previewToken ? { previewToken: result.previewToken } : {}),
    });
  }),
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    completePasswordReset(token, password);
    res.json({ message: 'Your password has been updated. Please sign in with your new password.' });
  }),
);

router.post(
  '/demo-login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { role } = demoLoginSchema.parse(req.body);
    const database = getDb();
    seedDemoData(database);

    const demoEmail = role === 'recruiter' ? 'recruiter.demo@talentiq.in' : 'candidate.demo@talentiq.in';
    const demoName = role === 'recruiter' ? 'Riya Kapoor (Demo Recruiter)' : 'Ananya Sharma (Demo Candidate)';
    let row = database.prepare('SELECT * FROM users WHERE lower(email) = ?').get(demoEmail) as unknown as UserRow | undefined;

    if (!row) {
      const id = role === 'recruiter' ? 'demo-user-recruiter' : 'demo-user-candidate';
      const ts = nowIso();
      database
        .prepare(
          `INSERT INTO users (id, email, password_hash, role, full_name, phone, company, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          id,
          demoEmail,
          hashPassword('Demo@1234'),
          role,
          demoName,
          '+91 98765 00000',
          role === 'recruiter' ? 'TalentIQ Demo Labs' : null,
          ts,
          ts,
        );
      row = database.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
    }

    if (!row) throw new AppError(500, 'DEMO_USER_ERROR', 'Unable to initialize demo account.');
    const user = mapUser(row);
    if (role === 'candidate') {
      const linked = database.prepare("SELECT id FROM candidates WHERE id = 'sample-cand-ananya'").get() as { id: string } | undefined;
      if (linked) {
        database.prepare('UPDATE candidates SET user_id = ? WHERE id = ?').run(user.id, linked.id);
      } else {
        ensureCandidateProfileForUser(user);
      }
    }
    const session = createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({
      user,
      expiresAt: session.expiresAt,
      demoNotice: 'Signed into clearly labelled demo mode. Demo records are kept separate from real accounts.',
    });
  }),
);

export default router;
