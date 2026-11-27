export type UserRole = 'recruiter' | 'candidate';
export type CandidateStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type PipelineStage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'selected' | 'not_selected';
export type JobStatus = 'active' | 'draft' | 'paused' | 'closed';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string | null;
  company: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EducationEntry {
  degree: string;
  field?: string;
  institution?: string;
  year?: string;
}

export interface ExperienceEntry {
  title: string;
  company?: string;
  start?: string;
  end?: string;
  description?: string;
}

export interface ProjectEntry {
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  year?: string;
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  year?: string;
}

export interface CandidatePreferences {
  preferredLocations?: string[];
  preferredWorkModes?: string[];
  preferredEmploymentTypes?: string[];
  targetRoles?: string[];
}

export interface IntegrityFinding {
  id: string;
  category: 'date_conflict' | 'missing_info' | 'claim_verification';
  severity: 'info' | 'attention' | 'review';
  title: string;
  detail: string;
  evidenceExcerpt: string;
  suggestion: string;
  confirmed: boolean;
}

export interface IntegrityReport {
  status: 'Information consistent' | 'Needs attention' | 'Manual verification recommended';
  overallIndicator: number;
  dateConflictCount: number;
  missingInfoCount: number;
  claimsVerificationCount: number;
  findings: IntegrityFinding[];
  analyzedAt: string;
  disclaimer: string;
}

export interface EvidenceItem {
  claim: string;
  category: 'skill' | 'experience' | 'education' | 'project' | 'keyword';
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
  excerpt: string;
}

export interface Candidate {
  id: string;
  userId?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects?: ProjectEntry[];
  certifications?: CertificationEntry[];
  portfolioLinks?: string[];
  preferences?: CandidatePreferences;
  expectedSalaryInr?: number | null;
  yearsExperience: number;
  resumeText?: string;
  stage: CandidateStage;
  source: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  resumeCount?: number;
  matchCount?: number;
  averageMatchScore?: number | null;
  latestJobId?: string | null;
  latestJobTitle?: string | null;
  latestJobScore?: number | null;
}

export interface ResumeRecord {
  id: string;
  candidateId: string | null;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: 'processed' | 'failed';
  errorMessage: string | null;
  textLength: number;
  isSample: boolean;
  createdAt: string;
  storedName?: string;
  resumeText?: string;
  candidateName?: string | null;
  integrityReport?: IntegrityReport | null;
}

export interface Job {
  id: string;
  title: string;
  company?: string;
  department: string;
  location: string;
  workMode?: string;
  employmentType: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number;
  maxExperience: number;
  salaryMinInr?: number | null;
  salaryMaxInr?: number | null;
  educationRequirement: string;
  status: JobStatus;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
  applicantCount?: number;
  averageMatchScore?: number | null;
}

export interface MatchWeights {
  skills: number;
  experience: number;
  education: number;
  keywords: number;
}

export interface MatchFactor {
  key: 'skills' | 'experience' | 'education' | 'keywords';
  label: string;
  score: number;
  weight: number;
  contribution: number;
  detail: string;
}

export interface MatchExplanation {
  summary: string;
  factors: MatchFactor[];
  methodology: string;
}

export interface MatchResult {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  educationScore: number;
  keywordScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  missingRequiredSkills: string[];
  strengths: string[];
  gaps: string[];
  reviewFlags: string[];
  evidence?: EvidenceItem[];
  explanation: MatchExplanation;
  weights: MatchWeights;
}

export interface StoredMatch extends MatchResult {
  id: string;
  candidateId: string;
  jobId: string;
  source: 'deterministic';
  createdAt: string;
  candidate?: Candidate;
  job?: Job;
}

export interface CandidateDetail extends Candidate {
  resumes: ResumeRecord[];
  matches: StoredMatch[];
  integrityReport?: IntegrityReport;
}

export interface JobRankings {
  job: Job;
  matches: StoredMatch[];
  candidateCount: number;
  lastRunAt: string | null;
}

export interface AiSuggestion {
  kind: string;
  suggestion: string;
  provider: 'gemini' | 'local-fallback';
  model: string;
  generatedAt: string;
  disclaimer: string;
}

export interface AiStatus {
  provider: 'gemini';
  configured: boolean;
  enabled: boolean;
  model: string;
  localMatchingAvailable: boolean;
  localFallbackAvailable?: boolean;
}

export interface AppSettings {
  weights: MatchWeights;
  ai: { enabled: boolean; model: string };
  apiKeyConfigured: boolean;
  sampleData: { candidates: number; jobs: number; resumes: number };
  provider: 'gemini';
  system: {
    apiBase: string;
    database: string;
    runtime: string;
    environment: string;
    maxUploadMb: number;
    aiKeyConfigured: boolean;
    razorpayConfigured?: boolean;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  candidate_id: string | null;
  job_id: string | null;
  meta: string;
  is_sample: number;
  created_at: string;
}

export interface DashboardData {
  stats: {
    totalCandidates: number;
    activeJobs: number;
    resumesProcessed: number;
    averageMatchScore: number | null;
    resumesThisWeek: number;
    interviewStageRate: number;
    offerConversion: number;
    sampleCandidates: number;
    totalApplications?: number;
    awaitingReview?: number;
    shortlistedCount?: number;
    interviewsInProgress?: number;
  };
  pipeline: { stage: CandidateStage; label: string; count: number }[];
  applicationFunnel?: { stage: PipelineStage; label: string; count: number }[];
  matchBands: { label: string; range: string; count: number; color: string }[];
  activeJobs: Job[];
  topMatches: StoredMatch[];
  recentActivity: ActivityItem[];
  recentCandidates: Candidate[];
  trend: { date: string; label: string; resumes: number; matches: number; pipeline: number }[];
  skills: { skill: string; count: number }[];
  sampleData: { candidates: number; jobs: number; resumes: number };
}

export interface AnalyticsData {
  summary: {
    totalCandidates: number;
    activeJobs: number;
    totalJobs: number;
    resumesProcessed: number;
    failedResumes: number;
    averageMatchScore: number | null;
    matchedCandidates: number;
    sampleCandidates: number;
    totalApplications?: number;
    shortlistedCount?: number;
  };
  stages: { stage: CandidateStage; label: string; count: number }[];
  applicationFunnel?: { stage: PipelineStage; label: string; count: number }[];
  seniority: { label: string; count: number }[];
  skills: { skill: string; count: number }[];
  matchBands: { label: string; range: string; count: number; color: string }[];
  jobs: Job[];
  pipeline: {
    total: number;
    inScreening: number;
    inInterview: number;
    offers: number;
    hired: number;
    rejected: number;
    interviewsOrBeyond: number;
    offerRate: number;
    resumeSuccessRate: number;
  };
  trend: { date: string; label: string; resumes: number; matches: number; pipeline: number }[];
  recentActivity: ActivityItem[];
  scoreBandLabel: string | null;
}

export interface UploadResult {
  resume: ResumeRecord;
  candidate: Candidate;
  match: StoredMatch | null;
  integrityReport?: IntegrityReport;
  warnings: string[];
  duplicateCandidate: boolean;
}

export interface BlindCandidateProfile {
  anonymousId: string;
  candidateId: string;
  revealed: boolean;
  revealedAt: string | null;
  revealedBy: string | null;
  title: string | null;
  summary: string | null;
  skills: string[];
  yearsExperience: number;
  education: { degree: string; field?: string; year?: string }[];
  experience: { title: string; start?: string; end?: string; description?: string }[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  stage: CandidateStage;
  applicationStage?: PipelineStage | null;
  match?: StoredMatch | null;
  integrityReport?: IntegrityReport | null;
  redactionNotice: string;
  identity?: {
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
  };
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  candidateId: string;
  stage: PipelineStage;
  statusLabel?: string;
  matchId: string | null;
  coverNote: string | null;
  recruiterNotes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  job?: Job;
  candidate?: Candidate;
  match?: StoredMatch | null;
}

export interface AlternativeJobRecommendation {
  job: Job;
  matchScore: number;
  matchingSkills: string[];
  transferableSkills: string[];
  missingSkills: string[];
  whyRecommended: string;
  bridgeAction: {
    missingSkill: string;
    projectIdea: string;
    demonstrationTip: string;
  } | null;
  saved: boolean;
  alreadyApplied: boolean;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  skill: string;
  projectIdea: string;
  completed: boolean;
}

export interface CandidateRoadmap {
  id: string;
  userId: string;
  targetRole: string;
  milestones: RoadmapMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  amountPaise: number;
  currency: 'INR';
  intervalDays: number;
  features: string[];
  isActive: boolean;
}

export interface PaymentOrder {
  id: string;
  internalRef: string;
  userId: string;
  planId: string;
  gateway: 'razorpay';
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  status: 'created' | 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded';
  receipt: string;
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  amountPaise: number;
  currency: string;
  method: string | null;
  status: string;
  signatureVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface RecruiterSubscription {
  id: string;
  userId: string;
  planId: string;
  orderId: string;
  transactionId: string;
  status: 'active' | 'expired' | 'cancelled' | 'refunded';
  startsAt: string;
  expiresAt: string;
  plan?: SubscriptionPlan;
}
