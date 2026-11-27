import { Router } from 'express';
import { getDb, getSettings, logActivity, removeDemoData, saveSettings } from '../database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { seedDemoData } from '../seed.js';
import { settingsSchema } from '../validation.js';

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

function settingsPayload() {
  const settings = getSettings();
  const database = getDb();
  const count = (table: string, where = '1 = 1'): number => {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number };
    return Number(row.count) || 0;
  };
  return {
    ...settings,
    sampleData: {
      candidates: count('candidates', 'is_sample = 1'),
      jobs: count('jobs', 'is_sample = 1'),
      resumes: count('resumes', 'is_sample = 1'),
    },
    provider: 'gemini',
    system: {
      apiBase: '/api',
      database: 'SQLite',
      runtime: process.version,
      environment: process.argv.includes('--production') || process.env.NODE_ENV === 'production' ? 'production' : 'development',
      maxUploadMb: Math.min(25, Math.max(1, Number(process.env.MAX_FILE_SIZE_MB || 10) || 10)),
      aiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
    },
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(settingsPayload());
  }),
);

router.post(
  '/demo-data',
  asyncHandler(async (_req, res) => {
    seedDemoData(getDb());
    logActivity('demo_seeded', 'Sample data was loaded for demo walkthrough.');
    res.json(settingsPayload());
  }),
);

router.delete(
  '/demo-data',
  asyncHandler(async (_req, res) => {
    const removed = removeDemoData();
    const total = Object.values(removed).reduce((sum, value) => sum + value, 0);
    if (total > 0) logActivity('demo_removed', 'Sample data was removed from this workspace.');
    res.json({ removed });
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const input = settingsSchema.parse(req.body);
    saveSettings({ weights: input.weights, ai: input.ai });
    logActivity('settings_updated', input.weights ? 'Matching weights were updated.' : 'AI settings were updated.', {
      meta: { weights: input.weights ?? null, aiEnabled: input.ai?.enabled ?? null, model: input.ai?.model ?? null },
    });
    res.json(settingsPayload());
  }),
);

export default router;
