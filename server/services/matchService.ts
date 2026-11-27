import path from 'node:path';
import fs from 'node:fs';
import type { Candidate, Job, MatchWeights, StoredMatch } from '../types.js';
import {
  getDb,
  getSettings,
  logActivity,
  mapCandidate,
  mapJob,
  mapMatch,
  newId,
  nowIso,
  parseJson,
} from '../database.js';
import { calculateMatch } from './matchingEngine.js';
import { AppError } from '../middleware/errorHandler.js';

interface CandidateRowWithText {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  skills: string;
  education: string;
  experience: string;
  years_experience: number;
  resume_text: string;
  stage: string;
  source: string;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

export function findCandidate(id: string, includeResume = true): Candidate | null {
  const row = getDb().prepare('SELECT * FROM candidates WHERE id = ?').get(id) as CandidateRowWithText | undefined;
  if (!row) return null;
  return mapCandidate(row, includeResume);
}

export function requireCandidate(id: string, includeResume = true): Candidate {
  const candidate = findCandidate(id, includeResume);
  if (!candidate) throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
  return candidate;
}

export function findJob(id: string): Job | null {
  const row = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Parameters<typeof mapJob>[0] | undefined;
  return row ? mapJob(row) : null;
}

export function requireJob(id: string): Job {
  const job = findJob(id);
  if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  return job;
}

export function persistMatch(candidate: Candidate, job: Job, weightsInput?: Partial<MatchWeights>): StoredMatch {
  const weights = weightsInput ?? getSettings().weights;
  const result = calculateMatch(candidate, job, weights);
  const id = newId();
  const createdAt = nowIso();
  getDb().prepare(
    `INSERT INTO matches (id, candidate_id, job_id, overall_score, skills_score, experience_score, education_score, keyword_score, matched_skills, missing_skills, missing_required_skills, strengths, gaps, review_flags, evidence, explanation, weights, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    candidate.id,
    job.id,
    result.overallScore,
    result.skillsScore,
    result.experienceScore,
    result.educationScore,
    result.keywordScore,
    JSON.stringify(result.matchedSkills),
    JSON.stringify(result.missingSkills),
    JSON.stringify(result.missingRequiredSkills),
    JSON.stringify(result.strengths),
    JSON.stringify(result.gaps),
    JSON.stringify(result.reviewFlags),
    JSON.stringify(result.evidence ?? []),
    JSON.stringify(result.explanation),
    JSON.stringify(result.weights),
    'deterministic',
    createdAt,
  );

  if (candidate.stage === 'new') {
    getDb().prepare('UPDATE candidates SET stage = ?, updated_at = ? WHERE id = ?').run('screening', nowIso(), candidate.id);
  }

  return {
    ...result,
    id,
    candidateId: candidate.id,
    jobId: job.id,
    source: 'deterministic',
    createdAt,
    candidate: { ...candidate, stage: candidate.stage === 'new' ? 'screening' : candidate.stage },
    job,
  };
}

export function runMatchForCandidate(candidateId: string, jobId: string): StoredMatch {
  const candidate = requireCandidate(candidateId);
  const job = requireJob(jobId);
  const match = persistMatch(candidate, job);
  logActivity('match_run', `${candidate.name} was matched to ${job.title} at ${Math.round(match.overallScore)}%.`, {
    candidateId: candidate.id,
    jobId: job.id,
    meta: { matchId: match.id, score: match.overallScore },
  });
  return match;
}

export function latestMatchRowsForJob(jobId: string): StoredMatch[] {
  const rows = getDb().prepare('SELECT * FROM matches WHERE job_id = ? ORDER BY created_at DESC').all(jobId) as unknown as Parameters<typeof mapMatch>[0][];
  const seen = new Set<string>();
  const matches: StoredMatch[] = [];
  for (const row of rows) {
    if (seen.has(row.candidate_id)) continue;
    seen.add(row.candidate_id);
    matches.push(mapMatch(row));
  }
  return matches;
}

export function getJobRankings(jobId: string) {
  const job = requireJob(jobId);
  const matches = latestMatchRowsForJob(jobId);
  const candidateRows = getDb().prepare('SELECT * FROM candidates').all() as unknown as CandidateRowWithText[];
  const candidateMap = new Map(candidateRows.map((row) => [row.id, mapCandidate(row)]));
  const ranked = matches
    .map((match) => ({ ...match, candidate: candidateMap.get(match.candidateId) }))
    .filter((match) => Boolean(match.candidate))
    .sort((a, b) => b.overallScore - a.overallScore || a.createdAt.localeCompare(b.createdAt));
  const lastRunAt = ranked.reduce<string | null>(
    (latest, match) => (!latest || match.createdAt > latest ? match.createdAt : latest),
    null,
  );
  return { job, matches: ranked, candidateCount: ranked.length, lastRunAt };
}

export function runJobMatching(jobId: string): { job: Job; matches: StoredMatch[]; runAt: string } {
  const job = requireJob(jobId);
  const candidates = (getDb().prepare('SELECT * FROM candidates').all() as unknown as CandidateRowWithText[])
    .map((row) => mapCandidate(row, true));
  if (candidates.length === 0) {
    throw new AppError(400, 'NO_CANDIDATES', 'Add at least one candidate before running matching.');
  }
  const weights = getSettings().weights;
  const matches: StoredMatch[] = [];
  for (const candidate of candidates) {
    matches.push(persistMatch(candidate, job, weights));
  }
  const runAt = nowIso();
  logActivity('match_run', `Matching refreshed for ${job.title} across ${matches.length} candidates.`, {
    jobId: job.id,
    meta: { candidateCount: matches.length },
  });
  return { job, matches, runAt };
}

export function getMatch(id: string): StoredMatch | null {
  const row = getDb().prepare('SELECT * FROM matches WHERE id = ?').get(id) as Parameters<typeof mapMatch>[0] | undefined;
  if (!row) return null;
  const candidate = findCandidate(row.candidate_id);
  const job = findJob(row.job_id);
  return { ...mapMatch(row), ...(candidate ? { candidate } : {}), ...(job ? { job } : {}) };
}

export function getCandidateMatchHistory(candidateId: string): StoredMatch[] {
  const rows = getDb().prepare('SELECT * FROM matches WHERE candidate_id = ? ORDER BY created_at DESC').all(candidateId) as unknown as Parameters<typeof mapMatch>[0][];
  const jobs = new Map<string, Job>();
  for (const row of rows) {
    if (!jobs.has(row.job_id)) {
      const job = findJob(row.job_id);
      if (job) jobs.set(row.job_id, job);
    }
  }
  return rows.map((row) => ({ ...mapMatch(row), job: jobs.get(row.job_id) }));
}

export interface MatchStats {
  averageScore: number | null;
  matchCount: number;
}

export function getLatestMatchStats(): {
  byCandidate: Map<string, MatchStats>;
  byJob: Map<string, MatchStats>;
  allLatest: StoredMatch[];
} {
  const rows = getDb()
    .prepare('SELECT * FROM matches ORDER BY created_at DESC')
    .all() as unknown as Parameters<typeof mapMatch>[0][];
  const seenCandidateJob = new Set<string>();
  const byCandidate = new Map<string, { sum: number; count: number }>();
  const byJob = new Map<string, { sum: number; count: number }>();
  const allLatest: StoredMatch[] = [];
  for (const row of rows) {
    const key = `${row.candidate_id}:${row.job_id}`;
    if (seenCandidateJob.has(key)) continue;
    seenCandidateJob.add(key);
    allLatest.push(mapMatch(row));
    const candidate = byCandidate.get(row.candidate_id) ?? { sum: 0, count: 0 };
    candidate.sum += Number(row.overall_score);
    candidate.count += 1;
    byCandidate.set(row.candidate_id, candidate);
    const job = byJob.get(row.job_id) ?? { sum: 0, count: 0 };
    job.sum += Number(row.overall_score);
    job.count += 1;
    byJob.set(row.job_id, job);
  }
  const mapStats = (input: Map<string, { sum: number; count: number }>) => {
    const result = new Map<string, MatchStats>();
    for (const [id, value] of input) {
      result.set(id, {
        averageScore: value.count ? Math.round((value.sum / value.count) * 10) / 10 : null,
        matchCount: value.count,
      });
    }
    return result;
  };
  return { byCandidate: mapStats(byCandidate), byJob: mapStats(byJob), allLatest };
}

export function cleanupResumeFile(storedName: string | null): void {
  if (!storedName) return;
  const uploadsDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || './data/uploads');
  const file = path.resolve(uploadsDir, path.basename(storedName));
  if (!file.startsWith(uploadsDir + path.sep)) return;
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // Cleanup is best-effort; the database record remains authoritative.
  }
}

export function matchWeightsFromUnknown(value: unknown): Partial<MatchWeights> | undefined {
  return parseJson<Partial<MatchWeights> | undefined>(value, undefined);
}