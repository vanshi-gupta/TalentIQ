import { z } from 'zod';

export const candidateStageSchema = z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']);
export const pipelineStageSchema = z.enum(['applied', 'screening', 'shortlisted', 'interview', 'selected', 'not_selected']);
export const jobStatusSchema = z.enum(['active', 'draft', 'paused', 'closed']);
export const userRoleSchema = z.enum(['recruiter', 'candidate']);

const shortText = (label: string, max = 160) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

const educationSchema = z.object({
  degree: z.string().trim().min(1, 'Degree is required.').max(160),
  field: z.string().trim().max(120).optional().default(''),
  institution: z.string().trim().max(160).optional().default(''),
  year: z.string().trim().max(20).optional().default(''),
});

const experienceSchema = z.object({
  title: z.string().trim().min(1, 'Role title is required.').max(160),
  company: z.string().trim().max(160).optional().default(''),
  start: z.string().trim().max(40).optional().default(''),
  end: z.string().trim().max(40).optional().default(''),
  description: z.string().trim().max(1200).optional().default(''),
});

const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(160),
  description: z.string().trim().max(1200).optional().default(''),
  technologies: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  url: z.string().trim().max(300).optional().default(''),
  year: z.string().trim().max(20).optional().default(''),
});

const certificationSchema = z.object({
  name: z.string().trim().min(1, 'Certification name is required.').max(160),
  issuer: z.string().trim().max(160).optional().default(''),
  year: z.string().trim().max(20).optional().default(''),
});

const preferencesSchema = z.object({
  preferredLocations: z.array(z.string().trim().min(1).max(80)).max(10).optional().default([]),
  preferredWorkModes: z.array(z.string().trim().min(1).max(40)).max(5).optional().default([]),
  preferredEmploymentTypes: z.array(z.string().trim().min(1).max(40)).max(5).optional().default([]),
  targetRoles: z.array(z.string().trim().min(1).max(100)).max(8).optional().default([]),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  role: userRoleSchema,
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  phone: shortText('Phone', 30).optional().default(''),
  company: shortText('Company', 120).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(200),
  password: z.string().min(1, 'Password is required.').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Reset token is required.').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

export const demoLoginSchema = z.object({
  role: userRoleSchema,
});

export const createCandidateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.union([z.string().trim().email('Enter a valid email address.').max(200), z.literal('')]).optional().default(''),
  phone: shortText('Phone', 40).optional().default(''),
  location: shortText('Location', 120).optional().default(''),
  title: shortText('Title', 120).optional().default(''),
  summary: z.string().trim().max(1500).optional().default(''),
  skills: z.array(z.string().trim().min(1).max(80)).max(60).optional().default([]),
  education: z.array(educationSchema).max(10).optional().default([]),
  experience: z.array(experienceSchema).max(20).optional().default([]),
  projects: z.array(projectSchema).max(15).optional().default([]),
  certifications: z.array(certificationSchema).max(15).optional().default([]),
  portfolioLinks: z.array(z.string().trim().min(1).max(300)).max(10).optional().default([]),
  preferences: preferencesSchema.optional(),
  expectedSalaryInr: z.number().int().min(0).max(500_000_000).nullable().optional(),
  yearsExperience: z.number().min(0).max(60).optional().default(0),
  resumeText: z.string().max(200_000).optional().default(''),
  stage: candidateStageSchema.optional().default('new'),
});

export const updateCandidateSchema = createCandidateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update.' },
);

export const stageSchema = z.object({
  stage: candidateStageSchema,
  reason: z.string().trim().max(400).optional(),
});

export const jobSchema = z.object({
  title: z.string().trim().min(1, 'Job title is required.').max(140),
  company: shortText('Company', 120).optional().default('TalentIQ Partner'),
  department: shortText('Department', 100).optional().default(''),
  location: shortText('Location', 120).optional().default(''),
  workMode: z.enum(['On-site', 'Hybrid', 'Remote']).optional().default('On-site'),
  employmentType: shortText('Employment type', 40).optional().default('Full-time'),
  description: z.string().trim().min(30, 'Add a job description (at least 30 characters).').max(20_000),
  requiredSkills: z.array(z.string().trim().min(1).max(80)).min(1, 'Add at least one required skill.').max(40),
  preferredSkills: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  minExperience: z.number().min(0, 'Experience cannot be negative.').max(50).optional().default(0),
  maxExperience: z.number().min(0, 'Experience cannot be negative.').max(50).optional().default(0),
  salaryMinInr: z.number().int().min(0).max(500_000_000).nullable().optional(),
  salaryMaxInr: z.number().int().min(0).max(500_000_000).nullable().optional(),
  educationRequirement: z.string().trim().max(120).optional().default(''),
  status: jobStatusSchema.optional().default('active'),
});

export const updateJobSchema = jobSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update.' },
);

export const runMatchSchema = z.object({
  candidateId: z.string().trim().min(1).max(100),
  jobId: z.string().trim().min(1).max(100),
});

export const runJobMatchSchema = z.object({
  jobId: z.string().trim().min(1).max(100),
  candidateId: z.string().trim().min(1).max(100).optional(),
});

export const weightsSchema = z.object({
  skills: z.number().min(0).max(100),
  experience: z.number().min(0).max(100),
  education: z.number().min(0).max(100),
  keywords: z.number().min(0).max(100),
}).refine(
  (weights) => Math.abs(weights.skills + weights.experience + weights.education + weights.keywords - 100) < 0.01,
  { message: 'Matching weights must add up to 100.' },
);

export const settingsSchema = z.object({
  weights: weightsSchema.optional(),
  ai: z.object({
    enabled: z.boolean(),
    model: z.string().trim().regex(/^[a-zA-Z0-9._-]+$/, 'Use a valid Gemini model identifier.').max(80).optional().default('gemini-2.0-flash'),
  }).optional(),
}).refine((value) => value.weights || value.ai, { message: 'Provide a setting to update.' });

export const aiCandidateSchema = z.object({ candidateId: z.string().trim().min(1).max(100) });
export const aiJobSchema = z.object({ jobId: z.string().trim().min(1).max(100) });
export const aiExplainSchema = z.object({
  candidateId: z.string().trim().min(1).max(100),
  jobId: z.string().trim().min(1).max(100),
  matchId: z.string().trim().min(1).max(100).optional(),
});
export const aiCompareSchema = z.object({
  candidateIds: z.array(z.string().trim().min(1).max(100)).min(2).max(3),
  jobId: z.string().trim().min(1).max(100),
  blind: z.boolean().optional().default(false),
});
export const aiFeedbackSchema = z.object({
  candidateId: z.string().trim().min(1).max(100),
  jobId: z.string().trim().min(1).max(100),
  tone: z.enum(['encouraging', 'neutral', 'shortlist']).optional().default('encouraging'),
});

export const applyJobSchema = z.object({
  jobId: z.string().trim().min(1).max(100),
  coverNote: z.string().trim().max(1500).optional().default(''),
});

export const updateApplicationStageSchema = z.object({
  stage: pipelineStageSchema,
  reason: z.string().trim().max(500).optional().default(''),
  recruiterNotes: z.string().trim().max(1500).optional(),
});

export const revealIdentitySchema = z.object({
  candidateId: z.string().trim().min(1).max(100),
  jobId: z.string().trim().min(1).max(100).optional(),
  reason: z.string().trim().min(4, 'Provide a short reason for revealing candidate identity.').max(300),
});

export const createPaymentOrderSchema = z.object({
  planId: z.string().trim().min(1, 'Select a subscription plan.').max(100),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(4).max(120),
  razorpay_payment_id: z.string().trim().min(4).max(120),
  razorpay_signature: z.string().trim().min(16).max(200),
});

export const paymentFailureSchema = z.object({
  orderId: z.string().trim().min(4).max(120),
  reason: z.string().trim().max(300).optional().default('Payment was cancelled or failed at checkout.'),
  status: z.enum(['failed', 'cancelled']).optional().default('failed'),
});

export const roadmapToggleSchema = z.object({
  milestoneId: z.string().trim().min(1).max(100),
  completed: z.boolean(),
});
