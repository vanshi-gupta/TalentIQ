import { Router } from 'express';
import { getDb, getSettings, logActivity } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  aiAvailability,
  analyseJob,
  compareCandidatesAi,
  draftCandidateFeedback,
  explainMatch,
  suggestInterviewQuestions,
  summariseCandidate,
  summariseRecruitmentActivity,
  testConnection,
} from '../services/aiService.js';
import {
  getCandidateMatchHistory,
  getMatch,
  requireCandidate,
  requireJob,
} from '../services/matchService.js';
import {
  aiCandidateSchema,
  aiCompareSchema,
  aiExplainSchema,
  aiFeedbackSchema,
  aiJobSchema,
} from '../validation.js';

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(aiAvailability(getSettings()));
  }),
);

router.post(
  '/summarize-candidate',
  asyncHandler(async (req, res) => {
    const { candidateId } = aiCandidateSchema.parse(req.body);
    const candidate = requireCandidate(candidateId, true);
    const suggestion = await summariseCandidate(candidate, getSettings());
    logActivity('ai_suggestion', `AI summary generated for ${candidate.name}.`, {
      candidateId,
      meta: { kind: suggestion.kind, model: suggestion.model },
    });
    res.json(suggestion);
  }),
);

router.post(
  '/analyze-job',
  asyncHandler(async (req, res) => {
    const { jobId } = aiJobSchema.parse(req.body);
    const job = requireJob(jobId);
    const suggestion = await analyseJob(job, getSettings());
    logActivity('ai_suggestion', `AI role analysis generated for ${job.title}.`, {
      jobId,
      meta: { kind: suggestion.kind, model: suggestion.model },
    });
    res.json(suggestion);
  }),
);

router.post(
  '/explain-match',
  asyncHandler(async (req, res) => {
    const { candidateId, jobId, matchId } = aiExplainSchema.parse(req.body);
    const candidate = requireCandidate(candidateId, true);
    const job = requireJob(jobId);
    const match = matchId
      ? getMatch(matchId)
      : getCandidateMatchHistory(candidateId).find((item) => item.jobId === jobId) ?? null;
    if (!match) {
      throw new AppError(400, 'MATCH_REQUIRED', 'Run deterministic matching for this candidate and job before requesting an AI explanation.');
    }
    if (match.candidateId !== candidateId || match.jobId !== jobId) {
      throw new AppError(400, 'MATCH_MISMATCH', 'The match result does not belong to this candidate and job.');
    }
    const suggestion = await explainMatch(candidate, job, match, getSettings());
    logActivity('ai_suggestion', `AI explanation generated for ${candidate.name} × ${job.title}.`, {
      candidateId,
      jobId,
      meta: { kind: suggestion.kind, model: suggestion.model, matchId: match.id },
    });
    res.json(suggestion);
  }),
);

router.post(
  '/interview-questions',
  asyncHandler(async (req, res) => {
    const { candidateId, jobId } = aiExplainSchema.parse(req.body);
    const candidate = requireCandidate(candidateId, true);
    const job = requireJob(jobId);
    const suggestion = await suggestInterviewQuestions(candidate, job, getSettings());
    logActivity('ai_suggestion', `AI interview questions generated for ${candidate.name} × ${job.title}.`, {
      candidateId,
      jobId,
      meta: { kind: suggestion.kind, model: suggestion.model },
    });
    res.json(suggestion);
  }),
);

router.post(
  '/compare-candidates',
  asyncHandler(async (req, res) => {
    const { candidateIds, jobId, blind } = aiCompareSchema.parse(req.body);
    const job = requireJob(jobId);
    const candidates = candidateIds.map((id) => requireCandidate(id, true));
    const suggestion = await compareCandidatesAi(candidates, job, blind, getSettings());
    res.json(suggestion);
  }),
);

router.post(
  '/draft-feedback',
  asyncHandler(async (req, res) => {
    const { candidateId, jobId, tone } = aiFeedbackSchema.parse(req.body);
    const candidate = requireCandidate(candidateId, true);
    const job = requireJob(jobId);
    const suggestion = await draftCandidateFeedback(candidate, job, tone, getSettings());
    res.json(suggestion);
  }),
);

router.post(
  '/activity-summary',
  asyncHandler(async (_req, res) => {
    const database = getDb();
    const activeJobs = Number((database.prepare("SELECT COUNT(*) AS c FROM jobs WHERE status = 'active'").get() as { c: number }).c);
    const totalCandidates = Number((database.prepare('SELECT COUNT(*) AS c FROM candidates').get() as { c: number }).c);
    const shortlisted = Number((database.prepare("SELECT COUNT(*) AS c FROM applications WHERE stage = 'shortlisted'").get() as { c: number }).c);
    const interviews = Number((database.prepare("SELECT COUNT(*) AS c FROM candidates WHERE stage = 'interview'").get() as { c: number }).c);
    const recent = (database.prepare('SELECT message FROM activities ORDER BY created_at DESC LIMIT 5').all() as { message: string }[]).map((r) => r.message);
    const suggestion = await summariseRecruitmentActivity({ activeJobs, totalCandidates, shortlisted, interviews, recentMessages: recent }, getSettings());
    res.json(suggestion);
  }),
);

router.post(
  '/test',
  asyncHandler(async (_req, res) => {
    const suggestion = await testConnection(getSettings());
    res.json(suggestion);
  }),
);

export default router;
