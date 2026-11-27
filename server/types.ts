export type UserRole = 'recruiter' | 'candidate';

export type CandidateStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export type PipelineStage =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview'
  | 'selected'
  | 'not_selected';

export type JobStatus = 'active' | 'draft' | 'paused' | 'closed';

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
  recruiterId?: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
  applicantCount?: number;
  averageMatchScore?: number | null;
}

export interface ResumeRecord {
  id: string;
  candidateId: string | null;
  userId?: string | null;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: 'processed' | 'failed';
  errorMessage: string | null;
  textLength: number;
  isSample: boolean;
  createdAt: string;
  storedName?: string;
  integrityReport?: IntegrityReport | null;
}

export interface ResumeDetail extends ResumeRecord {
  resumeText?: string;
  candidateName?: string | null;
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

export interface EvidenceItem {
  claim: string;
  category: 'skill' | 'experience' | 'education' | 'project' | 'keyword';
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
  excerpt: string;
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

export interface AppSettings {
  weights: MatchWeights;
  ai: {
    enabled: boolean;
    model: string;
  };
  apiKeyConfigured: boolean;
}

export type IntegrityStatus =
  | 'Information consistent'
  | 'Needs attention'
  | 'Manual verification recommended';

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
  status: IntegrityStatus;
  overallIndicator: number;
  dateConflictCount: number;
  missingInfoCount: number;
  claimsVerificationCount: number;
  findings: IntegrityFinding[];
  analyzedAt: string;
  disclaimer: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  candidateId: string;
  userId: string | null;
  stage: PipelineStage;
  matchId: string | null;
  coverNote: string | null;
  recruiterNotes?: string | null;
  rejectionReason?: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  job?: Job;
  candidate?: Candidate;
  match?: StoredMatch | null;
}

export interface StageHistoryEntry {
  id: string;
  applicationId: string | null;
  candidateId: string;
  jobId: string | null;
  fromStage: string | null;
  toStage: string;
  changedByUserId: string | null;
  changedByName?: string | null;
  reason: string | null;
  createdAt: string;
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

export type PaymentOrderStatus = 'created' | 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentOrder {
  id: string;
  internalRef: string;
  userId: string;
  planId: string;
  gateway: 'razorpay';
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  status: PaymentOrderStatus;
  receipt: string;
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  userId: string;
  planId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  amountPaise: number;
  currency: string;
  method: string | null;
  status: PaymentOrderStatus;
  signatureVerified: boolean;
  verifiedAt: string | null;
  refundId: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan;
}
