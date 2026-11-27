import { Router } from 'express';
import { getDb, logActivity, mapCandidate, mapResume, newId, nowIso, writeAuditLog } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canonicalSkill, dedupeSkills } from '../services/skills.js';
import { analyzeResumeIntegrity } from '../services/integrityRadarService.js';
import {
  cleanupResumeFile,
  getCandidateMatchHistory,
  getLatestMatchStats,
  requireCandidate,
} from '../services/matchService.js';
import { createCandidateSchema, stageSchema, updateCandidateSchema } from '../validation.js';
import type {
  CandidatePreferences,
  CandidateStage,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
} from '../types.js';
import type { z } from 'zod';

type CandidateInput = z.infer<typeof createCandidateSchema>;
interface NormalisedCandidate {
  name?: string;
  email?: string | null;
  phone?: string;
  location?: string;
  title?: string;
  summary?: string;
  skills?: string[];
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  projects?: ProjectEntry[];
  certifications?: CertificationEntry[];
  portfolioLinks?: string[];
  preferences?: CandidatePreferences;
  expectedSalaryInr?: number | null;
  yearsExperience?: number;
  resumeText?: string;
  stage?: CandidateStage;
}

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

function normaliseCandidateInput(input: CandidateInput): NormalisedCandidate {
  const result: NormalisedCandidate = {};
  if (input.name !== undefined) result.name = input.name;
  if (input.email !== undefined) result.email = input.email.trim() ? input.email.trim().toLowerCase() : null;
  if (input.phone !== undefined) result.phone = input.phone;
  if (input.location !== undefined) result.location = input.location;
  if (input.title !== undefined) result.title = input.title;
  if (input.summary !== undefined) result.summary = input.summary;
  if (input.skills !== undefined) result.skills = dedupeSkills(input.skills.map((skill) => canonicalSkill(skill)));
  if (input.education !== undefined) {
    result.education = input.education.map((entry) => ({
      degree: entry.degree,
      field: entry.field,
      institution: entry.institution,
      year: entry.year,
    }));
  }
  if (input.experience !== undefined) {
    result.experience = input.experience.map((entry) => ({
      title: entry.title,
      company: entry.company,
      start: entry.start,
      end: entry.end,
      description: entry.description,
    }));
  }
  if (input.projects !== undefined) result.projects = input.projects;
  if (input.certifications !== undefined) result.certifications = input.certifications;
  if (input.portfolioLinks !== undefined) result.portfolioLinks = input.portfolioLinks;
  if (input.preferences !== undefined) result.preferences = input.preferences;
  if (input.expectedSalaryInr !== undefined) result.expectedSalaryInr = input.expectedSalaryInr;
  if (input.yearsExperience !== undefined) result.yearsExperience = input.yearsExperience;
  if (input.resumeText !== undefined) result.resumeText = input.resumeText;
  if (input.stage !== undefined) result.stage = input.stage;
  return result;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const stage = String(req.query.stage ?? '').trim();
    const skill = String(req.query.skill ?? '').trim().toLowerCase();
    const sort = String(req.query.sort ?? 'recent');
    const minExperience = req.query.minExperience === undefined ? 0 : Number(req.query.minExperience);
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50) || 50));
    const validStages: CandidateStage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    if (stage && !validStages.includes(stage as CandidateStage)) {
      throw new AppError(400, 'INVALID_STAGE', 'Unknown candidate stage filter.');
    }

    const rows = getDb().prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapCandidate>[0][];
    const resumeCounts = getDb()
      .prepare('SELECT candidate_id, COUNT(*) AS count FROM resumes GROUP BY candidate_id')
      .all() as { candidate_id: string | null; count: number }[];
    const resumeCountMap = new Map(resumeCounts.map((row) => [row.candidate_id, Number(row.count)]));
    const { byCandidate, allLatest } = getLatestMatchStats();
    const jobTitles = new Map(
      (getDb().prepare('SELECT id, title FROM jobs').all() as { id: string; title: string }[]).map((row) => [row.id, row.title]),
    );
    const latestMatch = new Map<string, (typeof allLatest)[number]>();
    for (const match of allLatest) {
      if (!latestMatch.has(match.candidateId)) latestMatch.set(match.candidateId, match);
    }

    let candidates = rows.map((row) => {
      const mapped = mapCandidate(row);
      const stats = byCandidate.get(row.id);
      const latest = latestMatch.get(row.id);
      return {
        ...mapped,
        resumeCount: resumeCountMap.get(row.id) ?? 0,
        matchCount: stats?.matchCount ?? 0,
        averageMatchScore: stats?.averageScore ?? null,
        latestJobId: latest?.jobId ?? null,
        latestJobTitle: latest ? (jobTitles.get(latest.jobId) ?? null) : null,
        latestJobScore: latest?.overallScore ?? null,
      };
    });

    if (search) {
      candidates = candidates.filter((candidate) =>
        [candidate.name, candidate.email, candidate.title, candidate.location, candidate.skills.join(' ')]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      );
    }
    if (stage) candidates = candidates.filter((candidate) => candidate.stage === stage);
    if (skill) {
      candidates = candidates.filter((candidate) =>
        candidate.skills.some((candidateSkill) => candidateSkill.toLowerCase().includes(skill)),
      );
    }
    if (Number.isFinite(minExperience) && minExperience > 0) {
      candidates = candidates.filter((candidate) => candidate.yearsExperience >= minExperience);
    }
    if (sort === 'name') candidates.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'experience') candidates.sort((a, b) => b.yearsExperience - a.yearsExperience);
    else if (sort === 'match') candidates.sort((a, b) => (b.averageMatchScore ?? -1) - (a.averageMatchScore ?? -1));
    else if (sort === 'oldest') candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = candidates.length;
    const paged = candidates.slice((page - 1) * pageSize, page * pageSize);
    res.json({ candidates: paged, total, page, pageSize, sampleCount: candidates.filter((candidate) => candidate.isSample).length });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createCandidateSchema.parse(req.body);
    const values = normaliseCandidateInput(input);
    const id = newId();
    const timestamp = nowIso();
    const summary = input.summary || [
      input.title || 'Candidate',
      input.yearsExperience > 0 ? `with ${input.yearsExperience} years of experience` : '',
      input.skills.length ? `Skills: ${input.skills.slice(0, 5).join(', ')}.` : '',
    ].filter(Boolean).join(' ');
    getDb().prepare(
      `INSERT INTO candidates (id, name, email, phone, location, title, summary, skills, education, experience, projects, certifications, portfolio_links, preferences, expected_salary_inr, years_experience, resume_text, stage, source, is_sample, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?)`,
    ).run(
      id,
      input.name,
      input.email ? input.email.toLowerCase() : null,
      input.phone || null,
      input.location || null,
      input.title || null,
      summary || null,
      JSON.stringify(values.skills ?? []),
      JSON.stringify(values.education ?? []),
      JSON.stringify(values.experience ?? []),
      JSON.stringify(values.projects ?? []),
      JSON.stringify(values.certifications ?? []),
      JSON.stringify(values.portfolioLinks ?? []),
      JSON.stringify(values.preferences ?? {}),
      values.expectedSalaryInr ?? null,
      input.yearsExperience,
      input.resumeText ?? '',
      input.stage,
      timestamp,
      timestamp,
    );
    logActivity('candidate_created', `${input.name} was added manually.`, { candidateId: id });
    const candidate = requireCandidate(id, true);
    res.status(201).json({ ...candidate, resumes: [], matches: [], resumeCount: 0, matchCount: 0, averageMatchScore: null });
  }),
);

router.get(
  '/:id/integrity',
  asyncHandler(async (req, res) => {
    const candidate = requireCandidate(req.params.id, true);
    res.json(analyzeResumeIntegrity(candidate));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const candidate = requireCandidate(req.params.id, true);
    const resumes = getDb()
      .prepare('SELECT * FROM resumes WHERE candidate_id = ? ORDER BY created_at DESC')
      .all(candidate.id) as unknown as Parameters<typeof mapResume>[0][];
    const matches = getCandidateMatchHistory(candidate.id);
    const latestByJob = new Map<string, number>();
    for (const match of matches) {
      if (!latestByJob.has(match.jobId)) latestByJob.set(match.jobId, match.overallScore);
    }
    const scores = [...latestByJob.values()];
    const latest = matches[0];
    const integrityReport = analyzeResumeIntegrity(candidate);
    res.json({
      ...candidate,
      resumes: resumes.map((resume) => mapResume(resume)),
      matches,
      integrityReport,
      resumeCount: resumes.length,
      matchCount: latestByJob.size,
      averageMatchScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null,
      latestJobId: latest?.jobId ?? null,
      latestJobTitle: latest?.job?.title ?? null,
      latestJobScore: latest?.overallScore ?? null,
    });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const current = requireCandidate(req.params.id, true);
    const parsedInput = updateCandidateSchema.parse(req.body);
    const values = normaliseCandidateInput(parsedInput as CandidateInput);
    const stageChanged = typeof values.stage === 'string' && values.stage !== current.stage;
    const merged = {
      name: values.name ?? current.name,
      email: values.email !== undefined ? values.email : current.email,
      phone: values.phone !== undefined ? values.phone || null : current.phone,
      location: values.location !== undefined ? values.location || null : current.location,
      title: values.title !== undefined ? values.title || null : current.title,
      summary: values.summary !== undefined ? values.summary || null : current.summary,
      skills: values.skills !== undefined ? values.skills : current.skills,
      education: values.education !== undefined ? values.education : current.education,
      experience: values.experience !== undefined ? values.experience : current.experience,
      projects: values.projects !== undefined ? values.projects : current.projects ?? [],
      certifications: values.certifications !== undefined ? values.certifications : current.certifications ?? [],
      portfolioLinks: values.portfolioLinks !== undefined ? values.portfolioLinks : current.portfolioLinks ?? [],
      preferences: values.preferences !== undefined ? values.preferences : current.preferences ?? {},
      expectedSalaryInr: values.expectedSalaryInr !== undefined ? values.expectedSalaryInr : current.expectedSalaryInr ?? null,
      yearsExperience: values.yearsExperience !== undefined ? values.yearsExperience : current.yearsExperience,
      resumeText: values.resumeText !== undefined ? values.resumeText : current.resumeText ?? '',
      stage: values.stage !== undefined ? values.stage : current.stage,
    };
    const ts = nowIso();
    getDb().prepare(
      `UPDATE candidates SET name = ?, email = ?, phone = ?, location = ?, title = ?, summary = ?, skills = ?, education = ?, experience = ?, projects = ?, certifications = ?, portfolio_links = ?, preferences = ?, expected_salary_inr = ?, years_experience = ?, resume_text = ?, stage = ?, updated_at = ? WHERE id = ?`,
    ).run(
      merged.name,
      merged.email || null,
      merged.phone,
      merged.location,
      merged.title,
      merged.summary,
      JSON.stringify(dedupeSkills(merged.skills)),
      JSON.stringify(merged.education),
      JSON.stringify(merged.experience),
      JSON.stringify(merged.projects),
      JSON.stringify(merged.certifications),
      JSON.stringify(merged.portfolioLinks),
      JSON.stringify(merged.preferences),
      merged.expectedSalaryInr,
      merged.yearsExperience,
      merged.resumeText,
      merged.stage,
      ts,
      current.id,
    );
    if (stageChanged) {
      getDb()
        .prepare('INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?)')
        .run(newId(), current.id, current.stage, merged.stage, req.user!.id, parsedInput.summary ? 'Updated with profile edit' : null, ts);
      logActivity('stage_changed', `${merged.name} moved to ${String(merged.stage).replace('_', ' ')}.`, {
        candidateId: current.id,
        meta: { from: current.stage, to: merged.stage },
      });
    } else {
      logActivity('candidate_updated', `${merged.name}'s profile was updated.`, { candidateId: current.id });
    }
    res.json(requireCandidate(current.id, true));
  }),
);

router.patch(
  '/:id/stage',
  asyncHandler(async (req, res) => {
    const { stage, reason } = stageSchema.parse(req.body);
    const candidate = requireCandidate(req.params.id, false);
    if (candidate.stage !== stage) {
      const ts = nowIso();
      getDb().prepare('UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?').run(stage, ts, candidate.id);
      getDb()
        .prepare('INSERT INTO hiring_stage_history (id, application_id, candidate_id, job_id, from_stage, to_stage, changed_by_user_id, reason, created_at) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?)')
        .run(newId(), candidate.id, candidate.stage, stage, req.user!.id, reason ?? null, ts);
      writeAuditLog({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'candidate_stage_changed',
        targetType: 'candidate',
        targetId: candidate.id,
        details: { from: candidate.stage, to: stage, reason: reason ?? null },
      });
      logActivity('stage_changed', `${candidate.name} moved to ${stage.replace('_', ' ')}.`, {
        candidateId: candidate.id,
        meta: { from: candidate.stage, to: stage, reason: reason ?? null },
      });
    }
    res.json(requireCandidate(candidate.id, true));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const candidate = requireCandidate(req.params.id, false);
    const files = getDb().prepare('SELECT stored_name FROM resumes WHERE candidate_id = ?').all(candidate.id) as { stored_name: string | null }[];
    const result = getDb().prepare('DELETE FROM candidates WHERE id = ?').run(candidate.id);
    if (result.changes === 0) throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    for (const file of files) cleanupResumeFile(file.stored_name);
    logActivity('candidate_deleted', `${candidate.name} was removed from TalentIQ.`, { meta: { name: candidate.name } });
    res.status(204).send();
  }),
);

export default router;
