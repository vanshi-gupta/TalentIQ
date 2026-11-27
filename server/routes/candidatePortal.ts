import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { getDb, logActivity, mapJob, mapMatch, mapResume, newId, nowIso } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ensureCandidateProfileForUser } from '../services/authService.js';
import { recommendAlternativeJobs } from '../services/alternativeJobsService.js';
import { analyzeSkillGaps, buildInterviewPrep, getOrGenerateRoadmap, toggleRoadmapMilestone } from '../services/careerService.js';
import { analyzeResumeIntegrity } from '../services/integrityRadarService.js';
import { calculateMatch } from '../services/matchingEngine.js';
import { findJob, persistMatch, requireCandidate } from '../services/matchService.js';
import { extractResumeText, fileTypeFromName, parseResume, safeOriginalName, validateFileMagic } from '../services/resumeParser.js';
import { canonicalSkill, dedupeSkills } from '../services/skills.js';
import { applyJobSchema, roadmapToggleSchema, updateCandidateSchema } from '../validation.js';
import type { Candidate, Job, PipelineStage } from '../types.js';

const router = Router();
router.use(requireAuth, requireRole('candidate'));

function maxUploadBytes(): number {
  const configured = Number(process.env.MAX_FILE_SIZE_MB || 10);
  const megabytes = Number.isFinite(configured) ? Math.min(25, Math.max(1, configured)) : 10;
  return megabytes * 1024 * 1024;
}

function uploadsDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || './data/uploads');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes(), files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => {
    if (!fileTypeFromName(file.originalname)) {
      callback(new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and DOCX resumes are accepted.'));
      return;
    }
    callback(null, true);
  },
});

function loadMyCandidate(userId: string, reqUser: NonNullable<Express.Request['user']>): Candidate {
  const candId = ensureCandidateProfileForUser(reqUser);
  return requireCandidate(candId, true);
}

function activeJobsList(): Job[] {
  const rows = getDb()
    .prepare("SELECT * FROM jobs WHERE status = 'active' ORDER BY created_at DESC")
    .all() as unknown as Parameters<typeof mapJob>[0][];
  return rows.map(mapJob);
}

function profileCompletionPercent(c: Candidate): number {
  let score = 0;
  if (c.name) score += 15;
  if (c.email) score += 10;
  if (c.phone) score += 10;
  if (c.location) score += 10;
  if (c.title) score += 10;
  if (c.skills.length >= 3) score += 15;
  if ((c.experience ?? []).length > 0) score += 15;
  if ((c.education ?? []).length > 0) score += 10;
  if (c.resumeText && c.resumeText.length > 50) score += 5;
  return Math.min(100, score);
}

const CANDIDATE_APPLICATION_LABELS: Record<PipelineStage, string> = {
  applied: 'Applied',
  screening: 'Under Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  selected: 'Selected',
  not_selected: 'Not Selected',
};

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const jobs = activeJobsList();
    const resumes = getDb()
      .prepare('SELECT * FROM resumes WHERE candidate_id = ? ORDER BY created_at DESC')
      .all(candidate.id) as unknown as Parameters<typeof mapResume>[0][];
    const apps = getDb()
      .prepare('SELECT * FROM applications WHERE candidate_id = ? ORDER BY updated_at DESC')
      .all(candidate.id) as { id: string; job_id: string; stage: string; created_at: string; updated_at: string }[];
    const savedRows = getDb()
      .prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?')
      .all(req.user!.id) as { job_id: string }[];

    const savedSet = new Set(savedRows.map((r) => r.job_id));
    const appliedSet = new Set(apps.map((a) => a.job_id));
    const { recommendations } = recommendAlternativeJobs({
      candidate,
      jobs,
      savedJobIds: savedSet,
      appliedJobIds: appliedSet,
      limit: 4,
    });
    const roadmap = getOrGenerateRoadmap(req.user!.id, candidate, jobs);
    const completedMilestones = roadmap.milestones.filter((m) => m.completed).length;

    res.json({
      profileCompletion: profileCompletionPercent(candidate),
      candidate,
      hasResume: resumes.some((r) => r.status === 'processed'),
      latestResume: resumes[0] ? mapResume(resumes[0]) : null,
      integrityStatus: analyzeResumeIntegrity(candidate).status,
      recommendations,
      applicationsCount: apps.length,
      applicationsSummary: apps.map((a) => ({
        id: a.id,
        jobId: a.job_id,
        stage: a.stage,
        label: CANDIDATE_APPLICATION_LABELS[a.stage as PipelineStage] ?? a.stage,
        updatedAt: a.updated_at,
      })),
      roadmapProgress: {
        targetRole: roadmap.targetRole,
        completed: completedMilestones,
        total: roadmap.milestones.length,
      },
      savedJobsCount: savedSet.size,
    });
  }),
);

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    res.json({
      candidate,
      profileCompletion: profileCompletionPercent(candidate),
      integrityReport: analyzeResumeIntegrity(candidate),
    });
  }),
);

router.put(
  '/profile',
  asyncHandler(async (req, res) => {
    const current = loadMyCandidate(req.user!.id, req.user!);
    const parsed = updateCandidateSchema.parse(req.body);
    const merged = {
      name: parsed.name ?? current.name,
      phone: parsed.phone !== undefined ? parsed.phone || null : current.phone,
      location: parsed.location !== undefined ? parsed.location || null : current.location,
      title: parsed.title !== undefined ? parsed.title || null : current.title,
      summary: parsed.summary !== undefined ? parsed.summary || null : current.summary,
      skills: parsed.skills !== undefined ? dedupeSkills(parsed.skills.map((s) => canonicalSkill(s))) : current.skills,
      education: parsed.education !== undefined ? parsed.education : current.education,
      experience: parsed.experience !== undefined ? parsed.experience : current.experience,
      projects: parsed.projects !== undefined ? parsed.projects : current.projects ?? [],
      certifications: parsed.certifications !== undefined ? parsed.certifications : current.certifications ?? [],
      portfolioLinks: parsed.portfolioLinks !== undefined ? parsed.portfolioLinks : current.portfolioLinks ?? [],
      preferences: parsed.preferences !== undefined ? parsed.preferences : current.preferences ?? {},
      expectedSalaryInr: parsed.expectedSalaryInr !== undefined ? parsed.expectedSalaryInr : current.expectedSalaryInr ?? null,
      yearsExperience: parsed.yearsExperience !== undefined ? parsed.yearsExperience : current.yearsExperience,
    };

    const ts = nowIso();
    getDb()
      .prepare(
        `UPDATE candidates
         SET name = ?, phone = ?, location = ?, title = ?, summary = ?, skills = ?, education = ?, experience = ?, projects = ?, certifications = ?, portfolio_links = ?, preferences = ?, expected_salary_inr = ?, years_experience = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        merged.name,
        merged.phone,
        merged.location,
        merged.title,
        merged.summary,
        JSON.stringify(merged.skills),
        JSON.stringify(merged.education),
        JSON.stringify(merged.experience),
        JSON.stringify(merged.projects),
        JSON.stringify(merged.certifications),
        JSON.stringify(merged.portfolioLinks),
        JSON.stringify(merged.preferences),
        merged.expectedSalaryInr,
        merged.yearsExperience,
        ts,
        current.id,
      );

    getDb().prepare('UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?').run(merged.name, merged.phone, ts, req.user!.id);
    const updated = requireCandidate(current.id, true);
    res.json({
      candidate: updated,
      profileCompletion: profileCompletionPercent(updated),
      integrityReport: analyzeResumeIntegrity(updated),
    });
  }),
);

router.get(
  '/resume',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const resumes = getDb()
      .prepare('SELECT * FROM resumes WHERE candidate_id = ? ORDER BY created_at DESC')
      .all(candidate.id) as unknown as Parameters<typeof mapResume>[0][];
    res.json({
      resumes: resumes.map((r) => mapResume(r)),
      candidate,
      integrityReport: analyzeResumeIntegrity(candidate),
    });
  }),
);

router.post(
  '/resume',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Choose a PDF or DOCX resume to upload.');
    const existingResumes = getDb()
      .prepare("SELECT id FROM resumes WHERE candidate_id = ? AND status = 'processed'")
      .all(candidate.id) as { id: string }[];
    const confirmReplace = req.query.confirmReplace === 'true' || req.body?.confirmReplace === 'true';
    if (existingResumes.length > 0 && !confirmReplace) {
      throw new AppError(
        409,
        'REPLACE_CONFIRMATION_REQUIRED',
        'You already have an uploaded resume. Confirm replacement to overwrite your extracted resume details.',
      );
    }

    const originalName = safeOriginalName(req.file.originalname);
    const fileType = fileTypeFromName(originalName);
    if (!fileType || !validateFileMagic(req.file.buffer, fileType)) {
      throw new AppError(400, 'INVALID_FILE_CONTENT', 'Please upload a valid, uncorrupted PDF or DOCX resume.');
    }

    const directory = uploadsDir();
    fs.mkdirSync(directory, { recursive: true });
    const storedName = `${randomUUID()}.${fileType}`;
    const storedPath = path.resolve(directory, storedName);
    await fs.promises.writeFile(storedPath, req.file.buffer, { flag: 'wx' });

    let parsed;
    try {
      const text = await extractResumeText(req.file.buffer, fileType);
      parsed = parseResume(text, originalName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not extract readable text from this resume.';
      throw new AppError(422, 'RESUME_UNREADABLE', message);
    }

    const ts = nowIso();
    const resumeId = newId();
    getDb()
      .prepare(
        `UPDATE candidates
         SET phone = COALESCE(?, phone),
             location = COALESCE(?, location),
             title = COALESCE(?, title),
             summary = COALESCE(?, summary),
             skills = ?,
             education = ?,
             experience = ?,
             years_experience = ?,
             resume_text = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        parsed.phone || null,
        parsed.location || null,
        parsed.title || null,
        parsed.summary || null,
        JSON.stringify(dedupeSkills([...candidate.skills, ...parsed.skills])),
        JSON.stringify(parsed.education.length ? parsed.education : candidate.education),
        JSON.stringify(parsed.experience.length ? parsed.experience : candidate.experience),
        Math.max(candidate.yearsExperience, parsed.yearsExperience),
        parsed.resumeText,
        ts,
        candidate.id,
      );

    const updated = requireCandidate(candidate.id, true);
    const integrityReport = analyzeResumeIntegrity(updated);

    getDb()
      .prepare(
        `INSERT INTO resumes (id, candidate_id, user_id, original_name, stored_name, file_type, file_size, status, error_message, text_length, integrity_report, is_sample, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'processed', NULL, ?, ?, 0, ?)`,
      )
      .run(resumeId, candidate.id, req.user!.id, originalName, storedName, fileType, req.file.size, parsed.resumeText.length, JSON.stringify(integrityReport), ts);

    logActivity('resume_processed', `${updated.name} uploaded a resume via Candidate Portal.`, { candidateId: candidate.id });
    res.status(201).json({
      resume: mapResume(getDb().prepare('SELECT * FROM resumes WHERE id = ?').get(resumeId) as unknown as Parameters<typeof mapResume>[0]),
      candidate: updated,
      integrityReport,
      warnings: parsed.warnings,
    });
  }),
);

router.get(
  '/integrity',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    res.json(analyzeResumeIntegrity(candidate));
  }),
);

router.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const jobs = activeJobsList();
    const savedSet = new Set(
      (getDb().prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?').all(req.user!.id) as { job_id: string }[]).map((r) => r.job_id),
    );
    const appliedMap = new Map(
      (getDb().prepare('SELECT job_id, stage FROM applications WHERE candidate_id = ?').all(candidate.id) as { job_id: string; stage: string }[]).map(
        (r) => [r.job_id, r.stage],
      ),
    );

    const search = String(req.query.search ?? '').trim().toLowerCase();
    const location = String(req.query.location ?? '').trim().toLowerCase();
    const employmentType = String(req.query.employmentType ?? '').trim().toLowerCase();
    const minSalary = req.query.minSalary ? Number(req.query.minSalary) : 0;
    const maxExperience = req.query.maxExperience !== undefined && req.query.maxExperience !== '' ? Number(req.query.maxExperience) : null;

    let filtered = jobs;
    if (search) {
      filtered = filtered.filter((j) =>
        [j.title, j.company, j.location, j.requiredSkills.join(' '), j.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(search)),
      );
    }
    if (location) filtered = filtered.filter((j) => j.location.toLowerCase().includes(location));
    if (employmentType) filtered = filtered.filter((j) => j.employmentType.toLowerCase() === employmentType);
    if (Number.isFinite(minSalary) && minSalary > 0) filtered = filtered.filter((j) => (j.salaryMaxInr ?? j.salaryMinInr ?? 0) >= minSalary);
    if (maxExperience !== null && Number.isFinite(maxExperience)) filtered = filtered.filter((j) => j.minExperience <= maxExperience);

    const enriched = filtered.map((job) => {
      const match = calculateMatch(candidate, job);
      return {
        job,
        match,
        saved: savedSet.has(job.id),
        applicationStage: appliedMap.get(job.id) ?? null,
      };
    });

    res.json({ jobs: enriched, total: enriched.length });
  }),
);

router.get(
  '/recommendations',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const jobs = activeJobsList();
    const excludeJobId = typeof req.query.excludeJobId === 'string' ? req.query.excludeJobId.trim() : undefined;
    const savedSet = new Set(
      (getDb().prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?').all(req.user!.id) as { job_id: string }[]).map((r) => r.job_id),
    );
    const appliedSet = new Set(
      (getDb().prepare('SELECT job_id FROM applications WHERE candidate_id = ?').all(candidate.id) as { job_id: string }[]).map((r) => r.job_id),
    );
    const result = recommendAlternativeJobs({
      candidate,
      jobs,
      savedJobIds: savedSet,
      appliedJobIds: appliedSet,
      excludeJobId,
    });
    res.json(result);
  }),
);

router.get(
  '/saved-jobs',
  asyncHandler(async (req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT j.* FROM saved_jobs s
         JOIN jobs j ON j.id = s.job_id
         WHERE s.user_id = ? AND j.status = 'active'
         ORDER BY s.created_at DESC`,
      )
      .all(req.user!.id) as unknown as Parameters<typeof mapJob>[0][];
    res.json({ jobs: rows.map(mapJob) });
  }),
);

router.post(
  '/saved-jobs/:jobId',
  asyncHandler(async (req, res) => {
    const job = findJob(req.params.jobId);
    if (!job || job.status !== 'active') throw new AppError(404, 'JOB_NOT_FOUND', 'Active job not found.');
    getDb()
      .prepare('INSERT OR IGNORE INTO saved_jobs (id, user_id, job_id, created_at) VALUES (?, ?, ?, ?)')
      .run(newId(), req.user!.id, job.id, nowIso());
    res.status(201).json({ saved: true, jobId: job.id });
  }),
);

router.delete(
  '/saved-jobs/:jobId',
  asyncHandler(async (req, res) => {
    getDb().prepare('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?').run(req.user!.id, req.params.jobId);
    res.status(204).send();
  }),
);

router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const rows = getDb()
      .prepare('SELECT id, job_id, candidate_id, stage, match_id, cover_note, created_at, updated_at FROM applications WHERE candidate_id = ? ORDER BY updated_at DESC')
      .all(candidate.id) as {
      id: string;
      job_id: string;
      candidate_id: string;
      stage: PipelineStage;
      match_id: string | null;
      cover_note: string | null;
      created_at: string;
      updated_at: string;
    }[];

    const applications = rows.map((row) => {
      const job = findJob(row.job_id);
      const matchRow = row.match_id
        ? (getDb().prepare('SELECT * FROM matches WHERE id = ?').get(row.match_id) as Parameters<typeof mapMatch>[0] | undefined)
        : undefined;
      return {
        id: row.id,
        jobId: row.job_id,
        stage: row.stage,
        statusLabel: CANDIDATE_APPLICATION_LABELS[row.stage] ?? row.stage,
        coverNote: row.cover_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        job,
        match: matchRow ? mapMatch(matchRow) : null,
      };
    });

    res.json({ applications });
  }),
);

router.post(
  '/apply',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const input = applyJobSchema.parse(req.body);
    const job = findJob(input.jobId);
    if (!job || job.status !== 'active') {
      throw new AppError(404, 'JOB_NOT_FOUND', 'This job is not currently accepting applications.');
    }

    const database = getDb();
    const existing = database
      .prepare('SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?')
      .get(job.id, candidate.id) as { id: string } | undefined;
    if (existing) {
      throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this job.');
    }

    const match = persistMatch(candidate, job);
    const appId = newId();
    const ts = nowIso();
    database
      .prepare(
        `INSERT INTO applications (id, job_id, candidate_id, user_id, stage, match_id, cover_note, is_sample, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'applied', ?, ?, ?, ?, ?)`,
      )
      .run(appId, job.id, candidate.id, req.user!.id, match.id, input.coverNote || null, candidate.isSample ? 1 : 0, ts, ts);

    database
      .prepare(
        `INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at)
         VALUES (?, ?, ?, ?, NULL, 'applied', ?, 'Candidate submitted application', ?)`,
      )
      .run(newId(), appId, candidate.id, job.id, req.user!.id, ts);

    logActivity('application_submitted', `${candidate.name} applied for ${job.title}.`, {
      candidateId: candidate.id,
      jobId: job.id,
    });

    // If match score is below 60%, surface constructive alternative roles immediately (never an automatic rejection!)
    const alternatives =
      match.overallScore < 60
        ? recommendAlternativeJobs({
            candidate,
            jobs: activeJobsList(),
            excludeJobId: job.id,
            limit: 4,
          })
        : null;

    res.status(201).json({
      application: {
        id: appId,
        jobId: job.id,
        stage: 'applied',
        statusLabel: 'Applied',
        createdAt: ts,
        job,
        match,
      },
      alternatives,
    });
  }),
);

router.get(
  '/skill-gaps',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId.trim() : undefined;
    res.json(analyzeSkillGaps(candidate, activeJobsList(), jobId));
  }),
);

router.get(
  '/roadmap',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole.trim() : undefined;
    const roadmap = getOrGenerateRoadmap(req.user!.id, candidate, activeJobsList(), targetRole);
    res.json({ roadmap });
  }),
);

router.patch(
  '/roadmap/milestone',
  asyncHandler(async (req, res) => {
    const input = roadmapToggleSchema.parse(req.body);
    const roadmap = toggleRoadmapMilestone(req.user!.id, input.milestoneId, input.completed);
    res.json({ roadmap });
  }),
);

router.get(
  '/interview-prep',
  asyncHandler(async (req, res) => {
    const candidate = loadMyCandidate(req.user!.id, req.user!);
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId.trim() : '';
    const job = jobId ? findJob(jobId) : activeJobsList()[0] ?? null;
    res.json(buildInterviewPrep(candidate, job));
  }),
);

export default router;
