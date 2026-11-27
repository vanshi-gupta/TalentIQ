import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppSettings,
  Candidate,
  CandidatePreferences,
  CandidateStage,
  CertificationEntry,
  EvidenceItem,
  Job,
  JobStatus,
  MatchResult,
  MatchWeights,
  ProjectEntry,
  ResumeRecord,
  StoredMatch,
  SubscriptionPlan,
  User,
  UserRole,
} from './types.js';
import { DEFAULT_WEIGHTS } from './services/matchingEngine.js';
import { seedDemoData } from './seed.js';

let db: DatabaseSync | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('recruiter', 'candidate')),
  full_name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  title TEXT,
  summary TEXT,
  skills TEXT NOT NULL DEFAULT '[]',
  education TEXT NOT NULL DEFAULT '[]',
  experience TEXT NOT NULL DEFAULT '[]',
  projects TEXT NOT NULL DEFAULT '[]',
  certifications TEXT NOT NULL DEFAULT '[]',
  portfolio_links TEXT NOT NULL DEFAULT '[]',
  preferences TEXT NOT NULL DEFAULT '{}',
  expected_salary_inr INTEGER,
  years_experience REAL NOT NULL DEFAULT 0,
  resume_text TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_email ON candidates(lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(stage);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT 'TalentIQ Partner',
  department TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  work_mode TEXT NOT NULL DEFAULT 'On-site',
  employment_type TEXT NOT NULL DEFAULT 'Full-time',
  description TEXT NOT NULL DEFAULT '',
  required_skills TEXT NOT NULL DEFAULT '[]',
  preferred_skills TEXT NOT NULL DEFAULT '[]',
  min_experience REAL NOT NULL DEFAULT 0,
  max_experience REAL NOT NULL DEFAULT 0,
  salary_min_inr INTEGER,
  salary_max_inr INTEGER,
  education_requirement TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  recruiter_id TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  candidate_id TEXT,
  user_id TEXT,
  original_name TEXT NOT NULL,
  stored_name TEXT,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  text_length INTEGER NOT NULL DEFAULT 0,
  integrity_report TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  overall_score REAL NOT NULL,
  skills_score REAL NOT NULL,
  experience_score REAL NOT NULL,
  education_score REAL NOT NULL,
  keyword_score REAL NOT NULL,
  matched_skills TEXT NOT NULL DEFAULT '[]',
  missing_skills TEXT NOT NULL DEFAULT '[]',
  missing_required_skills TEXT NOT NULL DEFAULT '[]',
  strengths TEXT NOT NULL DEFAULT '[]',
  gaps TEXT NOT NULL DEFAULT '[]',
  review_flags TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL DEFAULT '[]',
  explanation TEXT NOT NULL DEFAULT '{}',
  weights TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_matches_job ON matches(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_candidate ON matches(candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  user_id TEXT,
  stage TEXT NOT NULL DEFAULT 'applied',
  match_id TEXT,
  cover_note TEXT,
  recruiter_notes TEXT,
  rejection_reason TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id, stage);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);

CREATE TABLE IF NOT EXISTS hiring_stage_history (
  id TEXT PRIMARY KEY,
  application_id TEXT,
  candidate_id TEXT NOT NULL,
  job_id TEXT,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by_user_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stage_history_candidate ON hiring_stage_history(candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  UNIQUE (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS identity_reveals (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  job_id TEXT,
  recruiter_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (recruiter_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_identity_reveals_candidate ON identity_reveals(candidate_id, job_id);

CREATE TABLE IF NOT EXISTS candidate_roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  milestones_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON candidate_roadmaps(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  interval_days INTEGER NOT NULL DEFAULT 30,
  features_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  internal_ref TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT NOT NULL UNIQUE,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  receipt TEXT NOT NULL,
  notes_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  gateway_order_id TEXT NOT NULL,
  gateway_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT,
  status TEXT NOT NULL,
  signature_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  refund_id TEXT,
  refunded_at TEXT,
  raw_status_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES payment_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON payment_transactions(order_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  gateway_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recruiter_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON recruiter_subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  candidate_id TEXT,
  job_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export interface InitDatabaseOptions {
  dbPath?: string;
  seed?: boolean;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return randomUUID();
}

export function resolveDatabasePath(input?: string): string {
  return path.resolve(process.cwd(), input || process.env.DATABASE_PATH || './data/talentiq.db');
}

export function initDatabase(options: InitDatabaseOptions = {}): DatabaseSync {
  if (db) return db;
  const dbPath = resolveDatabasePath(options.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  ensureAdditiveColumns(db);
  ensureDefaultSettings(db);
  ensureSubscriptionPlans(db);
  const shouldSeed = options.seed ?? process.env.SEED_DEMO_DATA === 'true';
  if (shouldSeed) seedDemoData(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database has not been initialized.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function removeDemoData(): { candidates: number; jobs: number; resumes: number; matches: number; activities: number } {
  const database = getDb();
  const count = (table: string, where: string): number => {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number };
    return Number(row.count) || 0;
  };
  const counts = {
    candidates: count('candidates', 'is_sample = 1'),
    jobs: count('jobs', 'is_sample = 1'),
    resumes: count('resumes', 'is_sample = 1 OR candidate_id IN (SELECT id FROM candidates WHERE is_sample = 1)'),
    matches: count('matches', 'candidate_id IN (SELECT id FROM candidates WHERE is_sample = 1) OR job_id IN (SELECT id FROM jobs WHERE is_sample = 1)'),
    activities: count('activities', 'is_sample = 1'),
  };
  database.exec('BEGIN');
  try {
    database.exec('DELETE FROM activities WHERE is_sample = 1');
    database.exec('DELETE FROM applications WHERE is_sample = 1');
    database.exec('DELETE FROM resumes WHERE is_sample = 1 OR candidate_id IN (SELECT id FROM candidates WHERE is_sample = 1)');
    database.exec('DELETE FROM matches WHERE candidate_id IN (SELECT id FROM candidates WHERE is_sample = 1) OR job_id IN (SELECT id FROM jobs WHERE is_sample = 1)');
    database.exec('DELETE FROM candidates WHERE is_sample = 1');
    database.exec('DELETE FROM jobs WHERE is_sample = 1');
    database.exec('DELETE FROM users WHERE is_demo = 1');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return counts;
}

function addColumnIfMissing(database: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((col) => col.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureAdditiveColumns(database: DatabaseSync): void {
  addColumnIfMissing(database, 'jobs', 'max_experience', 'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(database, 'jobs', 'company', "TEXT NOT NULL DEFAULT 'TalentIQ Partner'");
  addColumnIfMissing(database, 'jobs', 'work_mode', "TEXT NOT NULL DEFAULT 'On-site'");
  addColumnIfMissing(database, 'jobs', 'salary_min_inr', 'INTEGER');
  addColumnIfMissing(database, 'jobs', 'salary_max_inr', 'INTEGER');
  addColumnIfMissing(database, 'jobs', 'recruiter_id', 'TEXT');

  addColumnIfMissing(database, 'candidates', 'user_id', 'TEXT');
  addColumnIfMissing(database, 'candidates', 'projects', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(database, 'candidates', 'certifications', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(database, 'candidates', 'portfolio_links', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(database, 'candidates', 'preferences', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing(database, 'candidates', 'expected_salary_inr', 'INTEGER');

  addColumnIfMissing(database, 'resumes', 'user_id', 'TEXT');
  addColumnIfMissing(database, 'resumes', 'integrity_report', 'TEXT');

  addColumnIfMissing(database, 'matches', 'evidence', "TEXT NOT NULL DEFAULT '[]'");
}

function ensureDefaultSettings(database: DatabaseSync): void {
  const defaults = {
    weights: DEFAULT_WEIGHTS,
    ai: {
      enabled: true,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
  };
  const insert = database.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  const existing = database.prepare('SELECT key FROM settings WHERE key = ?');
  for (const [key, value] of Object.entries(defaults)) {
    if (!existing.get(key)) insert.run(key, JSON.stringify(value), nowIso());
  }
}

function ensureSubscriptionPlans(database: DatabaseSync): void {
  const existing = database.prepare('SELECT COUNT(*) AS count FROM subscription_plans').get() as { count: number };
  if (Number(existing.count) > 0) return;

  const plans = [
    {
      id: 'plan-recruiter-starter',
      code: 'recruiter_starter',
      name: 'TalentIQ Starter',
      description: 'Essential explainable screening and blind review for small hiring teams.',
      amountPaise: 99900,
      intervalDays: 30,
      features: [
        'Up to 10 active job openings',
        'Explainable AI Match DNA & Evidence Ledger',
        'Blind Screening Mode with audit trail',
        'Resume Integrity Radar checks',
      ],
    },
    {
      id: 'plan-recruiter-growth',
      code: 'recruiter_growth',
      name: 'TalentIQ Growth',
      description: 'Full recruitment intelligence with candidate comparison, analytics, and AI assistant.',
      amountPaise: 249900,
      intervalDays: 30,
      features: [
        'Unlimited active job openings',
        'Side-by-side 3-candidate comparison',
        'AI Recruiter Assistant & interview briefs',
        'Full hiring pipeline & analytics export',
      ],
    },
    {
      id: 'plan-recruiter-scale',
      code: 'recruiter_scale',
      name: 'TalentIQ Scale (Annual)',
      description: 'Annual workspace license with priority compliance logging and high-volume screening.',
      amountPaise: 1999900,
      intervalDays: 365,
      features: [
        'Everything in Growth for 12 months',
        'Dedicated audit history & reveal logs',
        'Bulk multi-resume screening batches',
        'Priority support & custom match weights',
      ],
    },
  ];
  const stmt = database.prepare(
    `INSERT OR IGNORE INTO subscription_plans (id, code, name, description, amount_paise, currency, interval_days, features_json, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 1, ?)`,
  );
  const ts = nowIso();
  for (const plan of plans) {
    stmt.run(plan.id, plan.code, plan.name, plan.description, plan.amountPaise, plan.intervalDays, JSON.stringify(plan.features), ts);
  }
}

export function withTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  full_name: string;
  phone: string | null;
  company: string | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    fullName: row.full_name,
    phone: row.phone,
    company: row.company,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CandidateRow {
  id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  skills: string;
  education: string;
  experience: string;
  projects?: string;
  certifications?: string;
  portfolio_links?: string;
  preferences?: string;
  expected_salary_inr?: number | null;
  years_experience: number;
  resume_text: string;
  stage: string;
  source: string;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

interface JobRow {
  id: string;
  title: string;
  company?: string;
  department: string;
  location: string;
  work_mode?: string;
  employment_type: string;
  description: string;
  required_skills: string;
  preferred_skills: string;
  min_experience: number;
  max_experience: number;
  salary_min_inr?: number | null;
  salary_max_inr?: number | null;
  education_requirement: string;
  status: string;
  recruiter_id?: string | null;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

interface ResumeRow {
  id: string;
  candidate_id: string | null;
  user_id?: string | null;
  original_name: string;
  stored_name: string | null;
  file_type: string;
  file_size: number;
  status: string;
  error_message: string | null;
  text_length: number;
  integrity_report?: string | null;
  is_sample: number;
  created_at: string;
  resume_text?: string;
  candidate_name?: string | null;
}

interface MatchRow {
  id: string;
  candidate_id: string;
  job_id: string;
  overall_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  keyword_score: number;
  matched_skills: string;
  missing_skills: string;
  missing_required_skills: string;
  strengths: string;
  gaps: string;
  review_flags: string;
  evidence?: string;
  explanation: string;
  weights: string;
  source: string;
  created_at: string;
}

export function mapCandidate(row: CandidateRow, includeResumeText = false): Candidate {
  const candidate: Candidate = {
    id: row.id,
    userId: row.user_id ?? null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    title: row.title,
    summary: row.summary,
    skills: parseJson<string[]>(row.skills, []),
    education: parseJson(row.education, []),
    experience: parseJson(row.experience, []),
    projects: parseJson<ProjectEntry[]>(row.projects, []),
    certifications: parseJson<CertificationEntry[]>(row.certifications, []),
    portfolioLinks: parseJson<string[]>(row.portfolio_links, []),
    preferences: parseJson<CandidatePreferences>(row.preferences, {}),
    expectedSalaryInr: row.expected_salary_inr ?? null,
    yearsExperience: Number(row.years_experience) || 0,
    stage: row.stage as CandidateStage,
    source: row.source,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeResumeText) candidate.resumeText = row.resume_text;
  return candidate;
}

export function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company || 'TalentIQ Partner',
    department: row.department,
    location: row.location,
    workMode: row.work_mode || 'On-site',
    employmentType: row.employment_type,
    description: row.description,
    requiredSkills: parseJson<string[]>(row.required_skills, []),
    preferredSkills: parseJson<string[]>(row.preferred_skills, []),
    minExperience: Number(row.min_experience) || 0,
    maxExperience: Number(row.max_experience) || 0,
    salaryMinInr: row.salary_min_inr ?? null,
    salaryMaxInr: row.salary_max_inr ?? null,
    educationRequirement: row.education_requirement,
    status: row.status as JobStatus,
    recruiterId: row.recruiter_id ?? null,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapResume(row: ResumeRow, includeText = false): ResumeRecord {
  const resume: ResumeRecord = {
    id: row.id,
    candidateId: row.candidate_id,
    userId: row.user_id ?? null,
    originalName: row.original_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size) || 0,
    status: row.status as 'processed' | 'failed',
    errorMessage: row.error_message,
    textLength: Number(row.text_length) || 0,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
    integrityReport: parseJson(row.integrity_report, null),
  };
  if (includeText) {
    (resume as ResumeRecord & { resumeText?: string }).resumeText = row.resume_text ?? '';
    (resume as ResumeRecord & { candidateName?: string | null }).candidateName = row.candidate_name ?? null;
  }
  if (row.stored_name) resume.storedName = row.stored_name;
  return resume;
}

export function mapMatch(row: MatchRow, result?: MatchResult): StoredMatch {
  const explanation = result?.explanation ?? parseJson(row.explanation, {
    summary: '',
    factors: [],
    methodology: '',
  });
  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    overallScore: Number(row.overall_score),
    skillsScore: Number(row.skills_score),
    experienceScore: Number(row.experience_score),
    educationScore: Number(row.education_score),
    keywordScore: Number(row.keyword_score),
    matchedSkills: result?.matchedSkills ?? parseJson<string[]>(row.matched_skills, []),
    missingSkills: result?.missingSkills ?? parseJson<string[]>(row.missing_skills, []),
    missingRequiredSkills: result?.missingRequiredSkills ?? parseJson<string[]>(row.missing_required_skills, []),
    strengths: result?.strengths ?? parseJson<string[]>(row.strengths, []),
    gaps: result?.gaps ?? parseJson<string[]>(row.gaps, []),
    reviewFlags: result?.reviewFlags ?? parseJson<string[]>(row.review_flags, []),
    evidence: result?.evidence ?? parseJson<EvidenceItem[]>(row.evidence, []),
    explanation,
    weights: result?.weights ?? parseJson<MatchWeights>(row.weights, DEFAULT_WEIGHTS),
    source: 'deterministic',
    createdAt: row.created_at,
  };
}

export function mapSubscriptionPlan(row: {
  id: string;
  code: string;
  name: string;
  description: string;
  amount_paise: number;
  currency: string;
  interval_days: number;
  features_json: string;
  is_active: number;
}): SubscriptionPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    amountPaise: Number(row.amount_paise),
    currency: 'INR',
    intervalDays: Number(row.interval_days),
    features: parseJson<string[]>(row.features_json, []),
    isActive: Boolean(row.is_active),
  };
}

export function getSettings(): AppSettings {
  const database = getDb();
  const rows = database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const values = new Map(rows.map((row) => [row.key, parseJson(row.value, null)]));
  const weights = { ...DEFAULT_WEIGHTS, ...(values.get('weights') as Partial<MatchWeights> | null ?? {}) };
  const aiDefaults = {
    enabled: true,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  };
  const ai = { ...aiDefaults, ...((values.get('ai') as Partial<AppSettings['ai']> | null) ?? {}) };
  return {
    weights,
    ai,
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
  };
}

export function saveSettings(next: { weights?: MatchWeights; ai?: AppSettings['ai'] }): AppSettings {
  const database = getDb();
  const upsert = database.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  );
  if (next.weights) upsert.run('weights', JSON.stringify(next.weights), nowIso());
  if (next.ai) upsert.run('ai', JSON.stringify(next.ai), nowIso());
  return getSettings();
}

export function logActivity(
  type: string,
  message: string,
  options: { candidateId?: string | null; jobId?: string | null; meta?: Record<string, unknown>; isSample?: boolean } = {},
): void {
  const database = getDb();
  database.prepare(
    'INSERT INTO activities (id, type, message, candidate_id, job_id, meta, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    newId(),
    type,
    message,
    options.candidateId ?? null,
    options.jobId ?? null,
    JSON.stringify(options.meta ?? {}),
    options.isSample ? 1 : 0,
    nowIso(),
  );
}

export function writeAuditLog(params: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): void {
  const database = getDb();
  database.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, details_json, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    params.actorUserId ?? null,
    params.actorRole ?? null,
    params.action,
    params.targetType ?? null,
    params.targetId ?? null,
    JSON.stringify(params.details ?? {}),
    params.ipAddress ?? null,
    nowIso(),
  );
}

export function getDatabasePath(): string {
  return resolveDatabasePath();
}
