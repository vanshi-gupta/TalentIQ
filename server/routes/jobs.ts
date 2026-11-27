import { Router } from 'express';
import { getDb, logActivity, mapJob, newId, nowIso } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canonicalSkill, dedupeSkills } from '../services/skills.js';
import { getLatestMatchStats, requireJob } from '../services/matchService.js';
import { jobSchema, jobStatusSchema, updateJobSchema } from '../validation.js';
import type { JobStatus } from '../types.js';
import type { z } from 'zod';

type JobInput = z.infer<typeof jobSchema>;
interface NormalisedJob {
  title?: string;
  company?: string;
  department?: string;
  location?: string;
  workMode?: string;
  employmentType?: string;
  description?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  minExperience?: number;
  maxExperience?: number;
  salaryMinInr?: number | null;
  salaryMaxInr?: number | null;
  educationRequirement?: string;
  status?: JobStatus;
}

const router = Router();

function normaliseJobInput(input: JobInput): NormalisedJob {
  const result: NormalisedJob = {};
  if (input.title !== undefined) result.title = input.title;
  if (input.company !== undefined) result.company = input.company;
  if (input.department !== undefined) result.department = input.department;
  if (input.location !== undefined) result.location = input.location;
  if (input.workMode !== undefined) result.workMode = input.workMode;
  if (input.employmentType !== undefined) result.employmentType = input.employmentType;
  if (input.description !== undefined) result.description = input.description;
  if (input.requiredSkills !== undefined) result.requiredSkills = dedupeSkills(input.requiredSkills.map((skill) => canonicalSkill(skill)));
  if (input.preferredSkills !== undefined) result.preferredSkills = dedupeSkills(input.preferredSkills.map((skill) => canonicalSkill(skill)));
  if (input.minExperience !== undefined) result.minExperience = input.minExperience;
  if (input.maxExperience !== undefined) result.maxExperience = input.maxExperience;
  if (input.salaryMinInr !== undefined) result.salaryMinInr = input.salaryMinInr;
  if (input.salaryMaxInr !== undefined) result.salaryMaxInr = input.salaryMaxInr;
  if (input.educationRequirement !== undefined) result.educationRequirement = input.educationRequirement;
  if (input.status !== undefined) result.status = input.status;
  return result;
}

function assertExperienceRange(min: number, max: number): void {
  if (max > 0 && max < min) {
    throw new AppError(400, 'INVALID_EXPERIENCE_RANGE', 'Maximum experience cannot be less than minimum experience.');
  }
}

function assertSalaryRange(min: number | null | undefined, max: number | null | undefined): void {
  if (min !== null && min !== undefined && max !== null && max !== undefined && max > 0 && max < min) {
    throw new AppError(400, 'INVALID_SALARY_RANGE', 'Maximum INR salary cannot be less than minimum salary.');
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isRecruiter = req.user?.role === 'recruiter';
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = String(req.query.status ?? '').trim();
    const location = String(req.query.location ?? '').trim().toLowerCase();
    const employmentType = String(req.query.employmentType ?? '').trim().toLowerCase();
    const workMode = String(req.query.workMode ?? '').trim().toLowerCase();
    const minSalary = req.query.minSalary ? Number(req.query.minSalary) : 0;
    const maxExperience = req.query.maxExperience !== undefined && req.query.maxExperience !== '' ? Number(req.query.maxExperience) : null;
    const sort = String(req.query.sort ?? 'recent');
    const validStatuses: JobStatus[] = ['active', 'draft', 'paused', 'closed'];
    if (status && !validStatuses.includes(status as JobStatus)) {
      throw new AppError(400, 'INVALID_STATUS', 'Unknown job status filter.');
    }

    const rows = getDb().prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapJob>[0][];
    const { byJob } = getLatestMatchStats();
    const appCounts = new Map(
      (
        getDb().prepare('SELECT job_id, COUNT(*) AS count FROM applications GROUP BY job_id').all() as {
          job_id: string;
          count: number;
        }[]
      ).map((r) => [r.job_id, Number(r.count)]),
    );

    let jobs = rows
      .map((row) => {
        const stats = byJob.get(row.id);
        return {
          ...mapJob(row),
          candidateCount: stats?.matchCount ?? 0,
          applicantCount: appCounts.get(row.id) ?? 0,
          averageMatchScore: stats?.averageScore ?? null,
        };
      })
      .filter((job) => isRecruiter || job.status === 'active');

    if (search) {
      jobs = jobs.filter((job) =>
        [job.title, job.company, job.department, job.location, job.requiredSkills.join(' '), job.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      );
    }
    if (status) jobs = jobs.filter((job) => job.status === status);
    if (location) jobs = jobs.filter((job) => job.location.toLowerCase().includes(location));
    if (employmentType) jobs = jobs.filter((job) => job.employmentType.toLowerCase() === employmentType);
    if (workMode) jobs = jobs.filter((job) => (job.workMode ?? '').toLowerCase() === workMode);
    if (Number.isFinite(minSalary) && minSalary > 0) {
      jobs = jobs.filter((job) => (job.salaryMaxInr ?? job.salaryMinInr ?? 0) >= minSalary);
    }
    if (maxExperience !== null && Number.isFinite(maxExperience)) {
      jobs = jobs.filter((job) => job.minExperience <= maxExperience);
    }

    if (sort === 'title') jobs.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'candidates') jobs.sort((a, b) => (b.candidateCount ?? 0) - (a.candidateCount ?? 0));
    else if (sort === 'match') jobs.sort((a, b) => (b.averageMatchScore ?? -1) - (a.averageMatchScore ?? -1));
    else jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      jobs,
      total: jobs.length,
      counts: {
        active: jobs.filter((job) => job.status === 'active').length,
        draft: jobs.filter((job) => job.status === 'draft').length,
        paused: jobs.filter((job) => job.status === 'paused').length,
        closed: jobs.filter((job) => job.status === 'closed').length,
      },
    });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const input = jobSchema.parse(req.body);
    assertExperienceRange(input.minExperience, input.maxExperience);
    assertSalaryRange(input.salaryMinInr, input.salaryMaxInr);
    const values = normaliseJobInput(input);
    const id = newId();
    const timestamp = nowIso();
    getDb().prepare(
      `INSERT INTO jobs (id, title, company, department, location, work_mode, employment_type, description, required_skills, preferred_skills, min_experience, max_experience, salary_min_inr, salary_max_inr, education_requirement, status, recruiter_id, is_sample, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      id,
      input.title,
      values.company || req.user!.company || 'TalentIQ Partner',
      input.department,
      input.location,
      values.workMode ?? 'On-site',
      input.employmentType,
      input.description,
      JSON.stringify(values.requiredSkills),
      JSON.stringify(values.preferredSkills),
      input.minExperience,
      input.maxExperience,
      values.salaryMinInr ?? null,
      values.salaryMaxInr ?? null,
      input.educationRequirement,
      input.status,
      req.user!.id,
      timestamp,
      timestamp,
    );
    logActivity('job_created', `${input.title} was created as a ${input.status} role.`, { jobId: id });
    res.status(201).json(requireJob(id));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = requireJob(req.params.id);
    if (req.user?.role !== 'recruiter' && job.status !== 'active') {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
    }
    const { byJob } = getLatestMatchStats();
    const stats = byJob.get(job.id);
    const appRow = getDb().prepare('SELECT COUNT(*) AS count FROM applications WHERE job_id = ?').get(job.id) as { count: number };
    res.json({
      ...job,
      candidateCount: stats?.matchCount ?? 0,
      applicantCount: Number(appRow.count) || 0,
      averageMatchScore: stats?.averageScore ?? null,
    });
  }),
);

router.put(
  '/:id',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const current = requireJob(req.params.id);
    const parsedInput = updateJobSchema.parse(req.body);
    const values = normaliseJobInput(parsedInput as JobInput);
    const merged = {
      title: values.title ?? current.title,
      company: values.company ?? current.company ?? 'TalentIQ Partner',
      department: values.department ?? current.department,
      location: values.location ?? current.location,
      workMode: values.workMode ?? current.workMode ?? 'On-site',
      employmentType: values.employmentType ?? current.employmentType,
      description: values.description ?? current.description,
      requiredSkills: values.requiredSkills ?? current.requiredSkills,
      preferredSkills: values.preferredSkills ?? current.preferredSkills,
      minExperience: values.minExperience ?? current.minExperience,
      maxExperience: values.maxExperience ?? current.maxExperience,
      salaryMinInr: values.salaryMinInr !== undefined ? values.salaryMinInr : current.salaryMinInr ?? null,
      salaryMaxInr: values.salaryMaxInr !== undefined ? values.salaryMaxInr : current.salaryMaxInr ?? null,
      educationRequirement: values.educationRequirement ?? current.educationRequirement,
      status: values.status ?? current.status,
    };
    assertExperienceRange(merged.minExperience, merged.maxExperience);
    assertSalaryRange(merged.salaryMinInr, merged.salaryMaxInr);
    getDb().prepare(
      `UPDATE jobs SET title = ?, company = ?, department = ?, location = ?, work_mode = ?, employment_type = ?, description = ?, required_skills = ?, preferred_skills = ?, min_experience = ?, max_experience = ?, salary_min_inr = ?, salary_max_inr = ?, education_requirement = ?, status = ?, updated_at = ? WHERE id = ?`,
    ).run(
      merged.title,
      merged.company,
      merged.department,
      merged.location,
      merged.workMode,
      merged.employmentType,
      merged.description,
      JSON.stringify(dedupeSkills(merged.requiredSkills)),
      JSON.stringify(dedupeSkills(merged.preferredSkills)),
      merged.minExperience,
      merged.maxExperience,
      merged.salaryMinInr,
      merged.salaryMaxInr,
      merged.educationRequirement,
      merged.status,
      nowIso(),
      current.id,
    );
    logActivity('job_updated', `${merged.title} was updated.`, { jobId: current.id });
    res.json(requireJob(current.id));
  }),
);

router.patch(
  '/:id/status',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const job = requireJob(req.params.id);
    const status = jobStatusSchema.parse(req.body?.status);
    getDb().prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), job.id);
    logActivity('job_updated', `${job.title} status changed to ${status}.`, { jobId: job.id });
    res.json(requireJob(job.id));
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const job = requireJob(req.params.id);
    const result = getDb().prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
    if (result.changes === 0) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
    logActivity('job_deleted', `${job.title} was removed.`, { meta: { title: job.title } });
    res.status(204).send();
  }),
);

export default router;
