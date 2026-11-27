import { Router } from 'express';
import { getDb, mapCandidate, mapJob } from '../database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getLatestMatchStats } from '../services/matchService.js';

const router = Router();
router.use(requireAuth, requireRole('recruiter'));

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

const STAGE_ORDER = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

function scoreBand(score: number): string {
  if (score >= 85) return '85–100 · Strong';
  if (score >= 70) return '70–84 · Promising';
  if (score >= 55) return '55–69 · Review';
  return '<55 · Low overlap';
}

function latestActivity(limit = 8) {
  return getDb()
    .prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT ?')
    .all(limit) as {
      id: string;
      type: string;
      message: string;
      candidate_id: string | null;
      job_id: string | null;
      meta: string;
      is_sample: number;
      created_at: string;
    }[];
}

function stageCounts(candidates: ReturnType<typeof mapCandidate>[]) {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: candidates.filter((candidate) => candidate.stage === stage).length,
  }));
}

function seniorityCounts(candidates: ReturnType<typeof mapCandidate>[]) {
  const buckets = [
    { label: 'Early career', min: 0, max: 2, count: 0 },
    { label: 'Mid level', min: 2, max: 5, count: 0 },
    { label: 'Senior', min: 5, max: 8, count: 0 },
    { label: 'Lead / principal', min: 8, max: Infinity, count: 0 },
  ];
  for (const candidate of candidates) {
    const years = candidate.yearsExperience;
    const bucket = buckets.find((item) => years >= item.min && years < item.max) ?? buckets[buckets.length - 1];
    bucket.count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

function skillCounts(candidates: ReturnType<typeof mapCandidate>[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const skill of candidate.skills) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, 12);
}

function matchBands(allLatest: ReturnType<typeof getLatestMatchStats>['allLatest']) {
  const bands = [
    { label: 'Strong', range: '85–100', count: 0, color: '#236B50' },
    { label: 'Promising', range: '70–84', count: 0, color: '#7D5CE6' },
    { label: 'Review', range: '55–69', count: 0, color: '#C27E1B' },
    { label: 'Low overlap', range: '<55', count: 0, color: '#B94D48' },
  ];
  for (const match of allLatest) {
    const index = match.overallScore >= 85 ? 0 : match.overallScore >= 70 ? 1 : match.overallScore >= 55 ? 2 : 3;
    bands[index].count += 1;
  }
  return bands;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function activityTrend(days = 7) {
  const activities = getDb()
    .prepare('SELECT type, created_at FROM activities WHERE created_at >= ? ORDER BY created_at ASC')
    .all(new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)) as { type: string; created_at: string }[];
  const points: { date: string; label: string; resumes: number; matches: number; pipeline: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86_400_000);
    const key = dateKey(date);
    const dayActivities = activities.filter((activity) => activity.created_at.slice(0, 10) === key);
    points.push({
      date: key,
      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      resumes: dayActivities.filter((activity) => activity.type === 'resume_processed').length,
      matches: dayActivities.filter((activity) => activity.type === 'match_run').length,
      pipeline: dayActivities.filter((activity) => activity.type === 'stage_changed' || activity.type === 'candidate_created').length,
    });
  }
  return points;
}

function applicationFunnel() {
  const rows = getDb().prepare('SELECT stage, created_at, updated_at FROM applications').all() as {
    stage: string;
    created_at: string;
    updated_at: string;
  }[];
  const stages = [
    { stage: 'applied', label: 'Applied' },
    { stage: 'screening', label: 'Screening' },
    { stage: 'shortlisted', label: 'Shortlisted' },
    { stage: 'interview', label: 'Interview' },
    { stage: 'selected', label: 'Selected' },
    { stage: 'not_selected', label: 'Not Selected' },
  ];
  return {
    totalApplications: rows.length,
    funnel: stages.map((s) => ({ ...s, count: rows.filter((r) => r.stage === s.stage).length })),
    shortlistedCount: rows.filter((r) => r.stage === 'shortlisted').length,
    interviewCount: rows.filter((r) => r.stage === 'interview').length,
    selectedCount: rows.filter((r) => r.stage === 'selected').length,
  };
}

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const candidateRows = getDb().prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapCandidate>[0][];
    const jobRows = getDb().prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapJob>[0][];
    const candidates = candidateRows.map((row) => mapCandidate(row));
    const jobs = jobRows.map((row) => mapJob(row));
    const { byCandidate, byJob, allLatest } = getLatestMatchStats();
    const resumes = getDb().prepare('SELECT status, is_sample, created_at FROM resumes').all() as { status: string; is_sample: number; created_at: string }[];
    const processed = resumes.filter((resume) => resume.status === 'processed');
    const average = allLatest.length
      ? Math.round((allLatest.reduce((sum, match) => sum + match.overallScore, 0) / allLatest.length) * 10) / 10
      : null;
    const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const jobMap = new Map(jobs.map((job) => [job.id, job]));
    const latestByCandidate = new Map<string, (typeof allLatest)[number]>();
    for (const match of allLatest) {
      if (!latestByCandidate.has(match.candidateId)) latestByCandidate.set(match.candidateId, match);
    }
    const topMatches = [...allLatest]
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 6)
      .map((match) => ({
        ...match,
        candidate: candidateMap.get(match.candidateId),
        job: jobMap.get(match.jobId),
      }));
    const activeJobs = jobs
      .filter((job) => job.status === 'active')
      .map((job) => {
        const stats = byJob.get(job.id);
        return { ...job, candidateCount: stats?.matchCount ?? 0, averageMatchScore: stats?.averageScore ?? null };
      })
      .sort((a, b) => (b.averageMatchScore ?? 0) - (a.averageMatchScore ?? 0));
    const interviewsOrBeyond = candidates.filter((candidate) => ['interview', 'offer', 'hired'].includes(candidate.stage)).length;
    const offers = candidates.filter((candidate) => ['offer', 'hired'].includes(candidate.stage)).length;
    const resumesThisWeek = processed.filter((resume) => new Date(resume.created_at).getTime() >= Date.now() - 7 * 86_400_000).length;
    const appStats = applicationFunnel();
    const awaitingReview = candidates.filter((c) => c.stage === 'new').length;

    res.json({
      stats: {
        totalCandidates: candidates.length,
        activeJobs: jobs.filter((job) => job.status === 'active').length,
        resumesProcessed: processed.length,
        averageMatchScore: average,
        resumesThisWeek,
        interviewStageRate: candidates.length ? Math.round((interviewsOrBeyond / candidates.length) * 100) : 0,
        offerConversion: candidates.length ? Math.round((offers / candidates.length) * 100) : 0,
        sampleCandidates: candidates.filter((candidate) => candidate.isSample).length,
        totalApplications: appStats.totalApplications,
        awaitingReview,
        shortlistedCount: appStats.shortlistedCount,
        interviewsInProgress: Math.max(interviewsOrBeyond, appStats.interviewCount),
      },
      pipeline: stageCounts(candidates),
      applicationFunnel: appStats.funnel,
      matchBands: matchBands(allLatest),
      activeJobs,
      topMatches,
      recentActivity: latestActivity(7),
      recentCandidates: candidates.slice(0, 5).map((candidate) => {
        const latest = latestByCandidate.get(candidate.id);
        return {
          ...candidate,
          averageMatchScore: byCandidate.get(candidate.id)?.averageScore ?? null,
          latestJobId: latest?.jobId ?? null,
          latestJobTitle: latest ? (jobMap.get(latest.jobId)?.title ?? null) : null,
          latestJobScore: latest?.overallScore ?? null,
        };
      }),
      trend: activityTrend(7),
      skills: skillCounts(candidates).slice(0, 8),
      sampleData: {
        candidates: candidates.filter((candidate) => candidate.isSample).length,
        jobs: jobs.filter((job) => job.isSample).length,
        resumes: resumes.filter((resume) => resume.is_sample).length,
      },
    });
  }),
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const candidateRows = getDb().prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapCandidate>[0][];
    const jobRows = getDb().prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as unknown as Parameters<typeof mapJob>[0][];
    const candidates = candidateRows.map((row) => mapCandidate(row));
    const jobs = jobRows.map((row) => mapJob(row));
    const { byJob, allLatest } = getLatestMatchStats();
    const resumes = getDb().prepare('SELECT status FROM resumes').all() as { status: string }[];
    const processed = resumes.filter((resume) => resume.status === 'processed').length;
    const failed = resumes.filter((resume) => resume.status === 'failed').length;
    const average = allLatest.length
      ? Math.round((allLatest.reduce((sum, match) => sum + match.overallScore, 0) / allLatest.length) * 10) / 10
      : null;
    const matchedCandidates = new Set(allLatest.map((match) => match.candidateId)).size;
    const appStats = applicationFunnel();
    const appByJob = new Map(
      (
        getDb().prepare('SELECT job_id, COUNT(*) AS count FROM applications GROUP BY job_id').all() as {
          job_id: string;
          count: number;
        }[]
      ).map((r) => [r.job_id, Number(r.count)]),
    );

    res.json({
      summary: {
        totalCandidates: candidates.length,
        activeJobs: jobs.filter((job) => job.status === 'active').length,
        totalJobs: jobs.length,
        resumesProcessed: processed,
        failedResumes: failed,
        averageMatchScore: average,
        matchedCandidates,
        sampleCandidates: candidates.filter((candidate) => candidate.isSample).length,
        totalApplications: appStats.totalApplications,
        shortlistedCount: appStats.shortlistedCount,
      },
      stages: stageCounts(candidates),
      applicationFunnel: appStats.funnel,
      seniority: seniorityCounts(candidates),
      skills: skillCounts(candidates),
      matchBands: matchBands(allLatest),
      jobs: jobs.map((job) => {
        const stats = byJob.get(job.id);
        return {
          ...job,
          candidateCount: stats?.matchCount ?? 0,
          applicantCount: appByJob.get(job.id) ?? 0,
          averageMatchScore: stats?.averageScore ?? null,
        };
      }),
      pipeline: {
        total: candidates.length,
        inScreening: candidates.filter((candidate) => candidate.stage === 'screening').length,
        inInterview: candidates.filter((candidate) => candidate.stage === 'interview').length,
        offers: candidates.filter((candidate) => candidate.stage === 'offer').length,
        hired: candidates.filter((candidate) => candidate.stage === 'hired').length,
        rejected: candidates.filter((candidate) => candidate.stage === 'rejected').length,
        interviewsOrBeyond: candidates.filter((candidate) => ['interview', 'offer', 'hired'].includes(candidate.stage)).length,
        offerRate: candidates.length
          ? Math.round((candidates.filter((candidate) => ['offer', 'hired'].includes(candidate.stage)).length / candidates.length) * 100)
          : 0,
        resumeSuccessRate: processed + failed > 0 ? Math.round((processed / (processed + failed)) * 100) : 100,
      },
      trend: activityTrend(7),
      recentActivity: latestActivity(10),
      scoreBandLabel: average === null ? null : scoreBand(average),
    });
  }),
);

export default router;
