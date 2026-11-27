import { Router } from 'express';
import { getDb, logActivity, mapCandidate, mapJob, mapMatch, newId, nowIso, writeAuditLog } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildBlindCandidateProfile, revealCandidateIdentity } from '../services/blindScreeningService.js';
import { analyzeResumeIntegrity } from '../services/integrityRadarService.js';
import { calculateMatch } from '../services/matchingEngine.js';
import { latestMatchRowsForJob, persistMatch, requireCandidate, requireJob } from '../services/matchService.js';
import {
  aiCompareSchema,
  revealIdentitySchema,
  updateApplicationStageSchema,
} from '../validation.js';
import type { PipelineStage } from '../types.js';

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

interface ApplicationRow {
  id: string;
  job_id: string;
  candidate_id: string;
  user_id: string | null;
  stage: string;
  match_id: string | null;
  cover_note: string | null;
  recruiter_notes: string | null;
  rejection_reason: string | null;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

function mapApplication(row: ApplicationRow) {
  return {
    id: row.id,
    jobId: row.job_id,
    candidateId: row.candidate_id,
    userId: row.user_id,
    stage: row.stage as PipelineStage,
    matchId: row.match_id,
    coverNote: row.cover_note,
    recruiterNotes: row.recruiter_notes,
    rejectionReason: row.rejection_reason,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pipelineToCandidateStage(stage: PipelineStage): string {
  switch (stage) {
    case 'applied':
      return 'new';
    case 'screening':
    case 'shortlisted':
      return 'screening';
    case 'interview':
      return 'interview';
    case 'selected':
      return 'hired';
    case 'not_selected':
      return 'rejected';
  }
}

router.get(
  '/blind',
  asyncHandler(async (req, res) => {
    const jobId = String(req.query.jobId ?? '').trim() || null;
    const job = jobId ? requireJob(jobId) : null;
    const candidateRows = getDb().prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapCandidate>[0][];
    const candidates = candidateRows.map((r) => mapCandidate(r, true));

    const matchByCandidate = new Map<string, ReturnType<typeof latestMatchRowsForJob>[number]>();
    if (job) {
      for (const m of latestMatchRowsForJob(job.id)) {
        matchByCandidate.set(m.candidateId, m);
      }
    }

    const appStageMap = new Map<string, PipelineStage>();
    if (job) {
      const appRows = getDb()
        .prepare('SELECT candidate_id, stage FROM applications WHERE job_id = ?')
        .all(job.id) as { candidate_id: string; stage: string }[];
      for (const row of appRows) appStageMap.set(row.candidate_id, row.stage as PipelineStage);
    }

    const profiles = candidates.map((candidate) => {
      let match = matchByCandidate.get(candidate.id) ?? null;
      if (job && !match) {
        const computed = calculateMatch(candidate, job);
        match = {
          ...computed,
          id: `preview-${candidate.id}-${job.id}`,
          candidateId: candidate.id,
          jobId: job.id,
          source: 'deterministic',
          createdAt: nowIso(),
        };
      }
      return buildBlindCandidateProfile({
        candidate,
        jobId: job?.id ?? null,
        match,
        applicationStage: appStageMap.get(candidate.id) ?? null,
      });
    });

    if (job) {
      profiles.sort((a, b) => (b.match?.overallScore ?? -1) - (a.match?.overallScore ?? -1));
    }

    res.json({
      blindModeActive: true,
      job,
      candidates: profiles,
      total: profiles.length,
    });
  }),
);

router.post(
  '/reveal',
  asyncHandler(async (req, res) => {
    const input = revealIdentitySchema.parse(req.body);
    const candidate = requireCandidate(input.candidateId, false);
    if (input.jobId) requireJob(input.jobId);
    const revealed = revealCandidateIdentity({
      candidate,
      jobId: input.jobId ?? null,
      recruiter: req.user!,
      reason: input.reason,
      ipAddress: req.ip,
    });
    res.status(201).json(revealed);
  }),
);

router.get(
  '/reveals',
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT ir.*, u.full_name AS recruiter_name, c.name AS candidate_name, j.title AS job_title
         FROM identity_reveals ir
         LEFT JOIN users u ON u.id = ir.recruiter_user_id
         LEFT JOIN candidates c ON c.id = ir.candidate_id
         LEFT JOIN jobs j ON j.id = ir.job_id
         ORDER BY ir.created_at DESC LIMIT 50`,
      )
      .all() as {
      id: string;
      candidate_id: string;
      job_id: string | null;
      recruiter_user_id: string;
      reason: string;
      created_at: string;
      recruiter_name: string | null;
      candidate_name: string | null;
      job_title: string | null;
    }[];
    res.json({ reveals: rows });
  }),
);

router.post(
  '/compare',
  asyncHandler(async (req, res) => {
    const input = aiCompareSchema.parse(req.body);
    const job = requireJob(input.jobId);
    const uniqueIds = [...new Set(input.candidateIds)].slice(0, 3);
    if (uniqueIds.length < 2) {
      throw new AppError(400, 'COMPARE_MINIMUM', 'Select at least 2 distinct candidates to compare.');
    }

    const comparisons = uniqueIds.map((candidateId) => {
      const candidate = requireCandidate(candidateId, true);
      const match = persistMatch(candidate, job);
      const integrity = analyzeResumeIntegrity(candidate);
      if (input.blind) {
        return {
          blind: true,
          profile: buildBlindCandidateProfile({
            candidate,
            jobId: job.id,
            match,
            forceBlind: true,
          }),
          match: {
            ...match,
            candidate: undefined,
          },
          integrity,
        };
      }
      return {
        blind: false,
        candidate,
        match,
        integrity,
      };
    });

    res.json({
      job,
      blind: input.blind,
      comparisons,
      disclaimer:
        'Candidate comparison summarizes deterministic job-fit factors, evidence, and integrity flags. Final hiring decisions belong strictly to the recruiter.',
    });
  }),
);

router.get(
  '/pipeline',
  asyncHandler(async (req, res) => {
    const jobId = String(req.query.jobId ?? '').trim() || null;
    const database = getDb();
    const rows = (jobId
      ? database.prepare('SELECT * FROM applications WHERE job_id = ? ORDER BY updated_at DESC').all(jobId)
      : database.prepare('SELECT * FROM applications ORDER BY updated_at DESC').all()) as unknown as ApplicationRow[];

    const jobsMap = new Map(
      (database.prepare('SELECT * FROM jobs').all() as unknown as Parameters<typeof mapJob>[0][]).map((j) => [j.id, mapJob(j)]),
    );
    const candMap = new Map(
      (database.prepare('SELECT * FROM candidates').all() as unknown as Parameters<typeof mapCandidate>[0][]).map((c) => [c.id, mapCandidate(c)]),
    );

    const applications = rows.map((row) => {
      const mapped = mapApplication(row);
      const matchRow = mapped.matchId
        ? (database.prepare('SELECT * FROM matches WHERE id = ?').get(mapped.matchId) as Parameters<typeof mapMatch>[0] | undefined)
        : undefined;
      return {
        ...mapped,
        job: jobsMap.get(mapped.jobId),
        candidate: candMap.get(mapped.candidateId),
        match: matchRow ? mapMatch(matchRow) : null,
      };
    });

    const history = database
      .prepare(
        `SELECT h.*, u.full_name AS changed_by_name
         FROM hiring_stage_history h
         LEFT JOIN users u ON u.id = h.changed_by_user_id
         ORDER BY h.created_at DESC LIMIT 60`,
      )
      .all();

    res.json({ applications, history });
  }),
);

router.post(
  '/pipeline/assign',
  asyncHandler(async (req, res) => {
    const candidateId = String(req.body?.candidateId ?? '').trim();
    const jobId = String(req.body?.jobId ?? '').trim();
    const stageInput = (req.body?.stage ?? 'screening') as PipelineStage;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const candidate = requireCandidate(candidateId, true);
    const job = requireJob(jobId);

    const database = getDb();
    const existing = database
      .prepare('SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?')
      .get(job.id, candidate.id) as unknown as ApplicationRow | undefined;

    const match = persistMatch(candidate, job);
    const ts = nowIso();

    if (existing) {
      database
        .prepare('UPDATE applications SET stage = ?, match_id = ?, updated_at = ? WHERE id = ?')
        .run(stageInput, match.id, ts, existing.id);
      if (existing.stage !== stageInput) {
        database
          .prepare(
            `INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(newId(), existing.id, candidate.id, job.id, existing.stage, stageInput, req.user!.id, reason || null, ts);
      }
      const updated = database.prepare('SELECT * FROM applications WHERE id = ?').get(existing.id) as unknown as ApplicationRow;
      res.json({ application: mapApplication(updated), match });
      return;
    }

    const appId = newId();
    database
      .prepare(
        `INSERT INTO applications (id, job_id, candidate_id, user_id, stage, match_id, is_sample, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(appId, job.id, candidate.id, candidate.userId ?? null, stageInput, match.id, candidate.isSample ? 1 : 0, ts, ts);

    database
      .prepare(
        `INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      )
      .run(newId(), appId, candidate.id, job.id, stageInput, req.user!.id, reason || 'Added to hiring pipeline', ts);

    database.prepare('UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?').run(pipelineToCandidateStage(stageInput), ts, candidate.id);
    logActivity('stage_changed', `${candidate.name} was placed in ${stageInput} for ${job.title}.`, {
      candidateId: candidate.id,
      jobId: job.id,
    });
    const created = database.prepare('SELECT * FROM applications WHERE id = ?').get(appId) as unknown as ApplicationRow;
    res.status(201).json({ application: mapApplication(created), match });
  }),
);

router.patch(
  '/pipeline/:applicationId',
  asyncHandler(async (req, res) => {
    const input = updateApplicationStageSchema.parse(req.body);
    const database = getDb();
    const row = database.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.applicationId) as unknown as ApplicationRow | undefined;
    if (!row) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');

    const ts = nowIso();
    const rejectionReason = input.stage === 'not_selected' ? input.reason || row.rejection_reason : row.rejection_reason;
    database
      .prepare('UPDATE applications SET stage = ?, recruiter_notes = COALESCE(?, recruiter_notes), rejection_reason = ?, updated_at = ? WHERE id = ?')
      .run(input.stage, input.recruiterNotes ?? null, rejectionReason ?? null, ts, row.id);

    if (row.stage !== input.stage) {
      database
        .prepare(
          `INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId(), row.id, row.candidate_id, row.job_id, row.stage, input.stage, req.user!.id, input.reason || null, ts);

      database
        .prepare('UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?')
        .run(pipelineToCandidateStage(input.stage), ts, row.candidate_id);

      writeAuditLog({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'application_stage_changed',
        targetType: 'application',
        targetId: row.id,
        details: { from: row.stage, to: input.stage, reason: input.reason || null },
      });

      const cand = database.prepare('SELECT name FROM candidates WHERE id = ?').get(row.candidate_id) as { name: string } | undefined;
      const job = database.prepare('SELECT title FROM jobs WHERE id = ?').get(row.job_id) as { title: string } | undefined;
      logActivity('stage_changed', `${cand?.name ?? 'Candidate'} moved from ${row.stage} to ${input.stage}${job ? ` (${job.title})` : ''}.`, {
        candidateId: row.candidate_id,
        jobId: row.job_id,
      });
    }

    const updated = database.prepare('SELECT * FROM applications WHERE id = ?').get(row.id) as unknown as ApplicationRow;
    res.json({ application: mapApplication(updated) });
  }),
);

export default router;
