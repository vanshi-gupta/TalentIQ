import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getCandidateMatchHistory,
  getJobRankings,
  getMatch,
  requireCandidate,
  runJobMatching,
  runMatchForCandidate,
} from '../services/matchService.js';
import { runJobMatchSchema } from '../validation.js';

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

router.get(
  '/job/:jobId',
  asyncHandler(async (req, res) => {
    res.json(getJobRankings(req.params.jobId));
  }),
);

router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const input = runJobMatchSchema.parse(req.body);
    if (input.candidateId) {
      const match = runMatchForCandidate(input.candidateId, input.jobId);
      res.status(201).json({ match, job: match.job, candidate: match.candidate, runAt: match.createdAt });
      return;
    }
    const run = runJobMatching(input.jobId);
    const rankings = getJobRankings(input.jobId);
    res.status(201).json({
      ...rankings,
      runAt: run.runAt,
      message: `Matched ${run.matches.length} candidates using the local deterministic engine.`,
    });
  }),
);

router.get(
  '/candidate/:candidateId',
  asyncHandler(async (req, res) => {
    const candidate = requireCandidate(req.params.candidateId, false);
    const matches = getCandidateMatchHistory(candidate.id);
    res.json({ candidate, matches, total: matches.length });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const match = getMatch(req.params.id);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'Match result not found.');
    res.json(match);
  }),
);

export default router;
