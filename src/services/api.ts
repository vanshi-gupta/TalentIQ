import type {
  AiStatus,
  AiSuggestion,
  AlternativeJobRecommendation,
  AnalyticsData,
  ApplicationRecord,
  AppSettings,
  BlindCandidateProfile,
  Candidate,
  CandidateDetail,
  CandidateRoadmap,
  CandidateStage,
  DashboardData,
  IntegrityReport,
  Job,
  JobRankings,
  JobStatus,
  MatchResult,
  MatchWeights,
  PaymentOrder,
  PaymentTransaction,
  PipelineStage,
  RecruiterSubscription,
  ResumeRecord,
  StoredMatch,
  SubscriptionPlan,
  UploadResult,
  User,
  UserRole,
} from '../types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { path?: string; message: string }[];

  constructor(status: number, code: string, message: string, details?: { path?: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function queryString(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const output = search.toString();
  return output ? `?${output}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the TalentIQ server. Check that it is running and try again.');
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, payload?.error?.code ?? 'REQUEST_FAILED', message, payload?.error?.details);
  }
  return payload as T;
}

export const api = {
  health: () => request<{ status: string; database: string; aiConfigured: boolean; razorpayConfigured: boolean }>('/api/health'),

  auth: {
    me: () => request<{ user: User; subscription?: RecruiterSubscription | null; candidateId?: string }>('/api/auth/me'),
    register: (body: { email: string; password: string; role: UserRole; fullName: string; phone?: string; company?: string }) =>
      request<{ user: User; expiresAt: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ user: User; expiresAt: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    demoLogin: (role: UserRole) =>
      request<{ user: User; expiresAt: string; demoNotice: string }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    forgotPassword: (email: string) =>
      request<{ message: string; emailConfigured: boolean }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  },

  candidates: {
    list: (params?: { search?: string; stage?: string; skill?: string; minExperience?: number; sort?: string; page?: number; pageSize?: number }) =>
      request<{ candidates: Candidate[]; total: number; page: number; pageSize: number; sampleCount: number }>(
        '/api/candidates' + queryString(params),
      ),
    get: (id: string) => request<CandidateDetail>(`/api/candidates/${id}`),
    integrity: (id: string) => request<IntegrityReport>(`/api/candidates/${id}/integrity`),
    create: (body: Record<string, unknown>) =>
      request<Candidate>('/api/candidates', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<Candidate>(`/api/candidates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/candidates/${id}`, { method: 'DELETE' }),
    updateStage: (id: string, stage: CandidateStage, reason?: string) =>
      request<Candidate>(`/api/candidates/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, reason }) }),
  },

  jobs: {
    list: (params?: { search?: string; status?: string; location?: string; employmentType?: string; workMode?: string; sort?: string }) =>
      request<{ jobs: Job[]; total: number; counts: { active: number; draft: number; paused: number; closed: number } }>(
        '/api/jobs' + queryString(params),
      ),
    get: (id: string) => request<Job>(`/api/jobs/${id}`),
    create: (body: Record<string, unknown>) =>
      request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<Job>(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    updateStatus: (id: string, status: JobStatus) =>
      request<Job>(`/api/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    remove: (id: string) => request<void>(`/api/jobs/${id}`, { method: 'DELETE' }),
  },

  resumes: {
    list: (params?: { status?: string; candidateId?: string }) =>
      request<{ resumes: ResumeRecord[]; total: number }>('/api/resumes' + queryString(params)),
    get: (id: string) => request<ResumeRecord>(`/api/resumes/${id}`),
    upload: (file: File, jobId?: string) => {
      const form = new FormData();
      form.append('file', file);
      if (jobId) form.append('jobId', jobId);
      return request<UploadResult>('/api/resumes/upload', { method: 'POST', body: form });
    },
    remove: (id: string) => request<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
    downloadUrl: (id: string) => `/api/resumes/${id}/download`,
  },

  matches: {
    job: (jobId: string) => request<JobRankings>(`/api/matches/job/${jobId}`),
    runJob: (jobId: string) =>
      request<JobRankings & { runAt: string; message: string }>('/api/matches/run', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      }),
    runCandidate: (candidateId: string, jobId: string) =>
      request<{ match: StoredMatch; job: Job; candidate: Candidate }>('/api/matches/run', {
        method: 'POST',
        body: JSON.stringify({ candidateId, jobId }),
      }),
    candidateHistory: (candidateId: string) =>
      request<{ candidate: Candidate; matches: StoredMatch[]; total: number }>(`/api/matches/candidate/${candidateId}`),
  },

  screening: {
    blindList: (jobId?: string) =>
      request<{ blindModeActive: boolean; job: Job | null; candidates: BlindCandidateProfile[]; total: number }>(
        '/api/screening/blind' + queryString({ jobId }),
      ),
    revealIdentity: (body: { candidateId: string; jobId?: string; reason: string }) =>
      request<{ revealed: boolean; revealedAt: string; revealedBy: string; anonymousId: string; identity: { name: string; email: string | null; phone: string | null; location: string | null } }>(
        '/api/screening/reveal',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    reveals: () => request<{ reveals: Array<{ id: string; candidate_id: string; job_id: string | null; reason: string; created_at: string; recruiter_name: string | null; candidate_name: string | null; job_title: string | null }> }>('/api/screening/reveals'),
    compare: (body: { candidateIds: string[]; jobId: string; blind?: boolean }) =>
      request<{ job: Job; blind: boolean; comparisons: Array<{ blind: boolean; candidate?: Candidate; profile?: BlindCandidateProfile; match: StoredMatch; integrity: IntegrityReport }>; disclaimer: string }>(
        '/api/screening/compare',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    pipeline: (jobId?: string) =>
      request<{ applications: ApplicationRecord[]; history: Array<{ id: string; candidate_id: string; from_stage: string | null; to_stage: string; reason: string | null; changed_by_name: string | null; created_at: string }> }>(
        '/api/screening/pipeline' + queryString({ jobId }),
      ),
    assignPipeline: (body: { candidateId: string; jobId: string; stage?: PipelineStage; reason?: string }) =>
      request<{ application: ApplicationRecord; match: StoredMatch }>('/api/screening/pipeline/assign', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updatePipelineStage: (applicationId: string, body: { stage: PipelineStage; reason?: string; recruiterNotes?: string }) =>
      request<{ application: ApplicationRecord }>(`/api/screening/pipeline/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  candidate: {
    dashboard: () =>
      request<{
        profileCompletion: number;
        candidate: Candidate;
        hasResume: boolean;
        latestResume: ResumeRecord | null;
        integrityStatus: IntegrityReport['status'];
        recommendations: AlternativeJobRecommendation[];
        applicationsCount: number;
        applicationsSummary: Array<{ id: string; jobId: string; stage: PipelineStage; label: string; updatedAt: string }>;
        roadmapProgress: { targetRole: string; completed: number; total: number };
        savedJobsCount: number;
      }>('/api/candidate/dashboard'),
    profile: () => request<{ candidate: Candidate; profileCompletion: number; integrityReport: IntegrityReport }>('/api/candidate/profile'),
    updateProfile: (body: Record<string, unknown>) =>
      request<{ candidate: Candidate; profileCompletion: number; integrityReport: IntegrityReport }>('/api/candidate/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    resume: () => request<{ resumes: ResumeRecord[]; candidate: Candidate; integrityReport: IntegrityReport }>('/api/candidate/resume'),
    uploadResume: (file: File, confirmReplace = false) => {
      const form = new FormData();
      form.append('file', file);
      if (confirmReplace) form.append('confirmReplace', 'true');
      return request<{ resume: ResumeRecord; candidate: Candidate; integrityReport: IntegrityReport; warnings: string[] }>(
        `/api/candidate/resume${confirmReplace ? '?confirmReplace=true' : ''}`,
        { method: 'POST', body: form },
      );
    },
    integrity: () => request<IntegrityReport>('/api/candidate/integrity'),
    jobs: (params?: { search?: string; location?: string; employmentType?: string; minSalary?: number; maxExperience?: number }) =>
      request<{ jobs: Array<{ job: Job; match: MatchResult; saved: boolean; applicationStage: PipelineStage | null }>; total: number }>(
        '/api/candidate/jobs' + queryString(params),
      ),
    recommendations: (excludeJobId?: string) =>
      request<{ recommendations: AlternativeJobRecommendation[]; skillSuggestions: Array<{ missingSkill: string; projectIdea: string; demonstrationTip: string }> }>(
        '/api/candidate/recommendations' + queryString({ excludeJobId }),
      ),
    savedJobs: () => request<{ jobs: Job[] }>('/api/candidate/saved-jobs'),
    saveJob: (jobId: string) => request<{ saved: boolean; jobId: string }>(`/api/candidate/saved-jobs/${jobId}`, { method: 'POST' }),
    unsaveJob: (jobId: string) => request<void>(`/api/candidate/saved-jobs/${jobId}`, { method: 'DELETE' }),
    applications: () => request<{ applications: ApplicationRecord[] }>('/api/candidate/applications'),
    apply: (jobId: string, coverNote?: string) =>
      request<{ application: ApplicationRecord; alternatives: { recommendations: AlternativeJobRecommendation[]; skillSuggestions: Array<{ missingSkill: string; projectIdea: string; demonstrationTip: string }> } | null }>(
        '/api/candidate/apply',
        { method: 'POST', body: JSON.stringify({ jobId, coverNote }) },
      ),
    skillGaps: (jobId?: string) =>
      request<{
        targetJob: Job | null;
        matchedSkills: string[];
        gaps: Array<{
          skill: string;
          priority: 'required' | 'preferred';
          whyItMatters: string;
          currentLevel: string;
          learningDirection: string;
          projectIdea: string;
          demonstrationTip: string;
          relatedJobCount: number;
        }>;
      }>('/api/candidate/skill-gaps' + queryString({ jobId })),
    roadmap: (targetRole?: string) => request<{ roadmap: CandidateRoadmap }>('/api/candidate/roadmap' + queryString({ targetRole })),
    toggleMilestone: (milestoneId: string, completed: boolean) =>
      request<{ roadmap: CandidateRoadmap }>('/api/candidate/roadmap/milestone', {
        method: 'PATCH',
        body: JSON.stringify({ milestoneId, completed }),
      }),
    interviewPrep: (jobId?: string) =>
      request<{
        roleTitle: string;
        jobId: string | null;
        technicalQuestions: Array<{ question: string; focusSkill: string; answerStructure: string }>;
        behavioralQuestions: Array<{ question: string; competency: string; answerStructure: string }>;
        areasToRevise: string[];
        practiceChecklist: Array<{ id: string; label: string }>;
        source: string;
      }>('/api/candidate/interview-prep' + queryString({ jobId })),
  },

  payments: {
    plans: () =>
      request<{
        plans: SubscriptionPlan[];
        gateway: { provider: string; configured: boolean; webhookConfigured: boolean; mode: 'unconfigured' | 'test' | 'live'; upiSupported: boolean };
      }>('/api/payments/plans'),
    subscription: () => request<{ subscription: RecruiterSubscription | null; transactions: PaymentTransaction[] }>('/api/payments/subscription'),
    createOrder: (planId: string) =>
      request<{
        order: PaymentOrder;
        checkout: {
          keyId: string;
          orderId: string;
          amountPaise: number;
          currency: 'INR';
          name: string;
          description: string;
          prefill: { name: string; email: string; contact: string };
          upiSupported: boolean;
          mode: 'test' | 'live';
        };
      }>('/api/payments/orders', { method: 'POST', body: JSON.stringify({ planId }) }),
    verify: (body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
      request<{
        verified: boolean;
        activated: boolean;
        status: string;
        message?: string;
        transaction: PaymentTransaction;
        subscription: RecruiterSubscription | null;
        order: PaymentOrder;
      }>('/api/payments/verify', { method: 'POST', body: JSON.stringify(body) }),
    markOrderStatus: (orderId: string, status: 'failed' | 'cancelled', reason: string) =>
      request<{ order: PaymentOrder }>(`/api/payments/orders/${orderId}/status-note`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),
    orderStatus: (orderId: string) =>
      request<{ order: PaymentOrder; transactions: PaymentTransaction[]; subscription: RecruiterSubscription | null }>(
        `/api/payments/orders/${orderId}`,
      ),
  },

  analytics: {
    dashboard: () => request<DashboardData>('/api/analytics/dashboard'),
    all: () => request<AnalyticsData>('/api/analytics'),
  },

  settings: {
    get: () => request<AppSettings>('/api/settings'),
    update: (body: { weights?: MatchWeights; ai?: { enabled: boolean; model: string } }) =>
      request<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
    seedDemoData: () => request<AppSettings>('/api/settings/demo-data', { method: 'POST' }),
    removeDemoData: () =>
      request<{ removed: { candidates: number; jobs: number; resumes: number; matches: number; activities: number } }>(
        '/api/settings/demo-data',
        { method: 'DELETE' },
      ),
  },

  ai: {
    status: () => request<AiStatus>('/api/ai/status'),
    summarizeCandidate: (candidateId: string) =>
      request<AiSuggestion>('/api/ai/summarize-candidate', {
        method: 'POST',
        body: JSON.stringify({ candidateId }),
      }),
    analyzeJob: (jobId: string) =>
      request<AiSuggestion>('/api/ai/analyze-job', { method: 'POST', body: JSON.stringify({ jobId }) }),
    explainMatch: (candidateId: string, jobId: string, matchId?: string) =>
      request<AiSuggestion>('/api/ai/explain-match', {
        method: 'POST',
        body: JSON.stringify({ candidateId, jobId, matchId }),
      }),
    interviewQuestions: (candidateId: string, jobId: string) =>
      request<AiSuggestion>('/api/ai/interview-questions', {
        method: 'POST',
        body: JSON.stringify({ candidateId, jobId }),
      }),
    compareCandidates: (candidateIds: string[], jobId: string, blind = false) =>
      request<AiSuggestion>('/api/ai/compare-candidates', {
        method: 'POST',
        body: JSON.stringify({ candidateIds, jobId, blind }),
      }),
    draftFeedback: (candidateId: string, jobId: string, tone: 'encouraging' | 'neutral' | 'shortlist' = 'encouraging') =>
      request<AiSuggestion>('/api/ai/draft-feedback', {
        method: 'POST',
        body: JSON.stringify({ candidateId, jobId, tone }),
      }),
    activitySummary: () => request<AiSuggestion>('/api/ai/activity-summary', { method: 'POST' }),
    test: () => request<AiSuggestion>('/api/ai/test', { method: 'POST' }),
  },
};
