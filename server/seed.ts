import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Candidate, EducationEntry, ExperienceEntry, Job } from './types.js';
import { calculateMatch, DEFAULT_WEIGHTS } from './services/matchingEngine.js';
import { dedupeSkills } from './services/skills.js';

interface SeedCandidate extends Candidate {
  resumeFileName: string;
  resumeFileSize: number;
}

function daysAgo(days: number, hours = 10): string {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
}

const education = (degree: string, field: string, institution: string, year: string): EducationEntry => ({
  degree,
  field,
  institution,
  year,
});

const experience = (title: string, company: string, start: string, end: string, description: string): ExperienceEntry => ({
  title,
  company,
  start,
  end,
  description,
});

const sampleCandidates: SeedCandidate[] = [
  {
    id: 'sample-cand-ananya',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, Karnataka',
    title: 'Senior Frontend Developer',
    summary: 'Frontend developer with six years of experience building clean, responsive web applications. Comfortable with React, TypeScript and design systems, and used to working closely with product and design teams.',
    skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Next.js', 'Tailwind CSS', 'Git'],
    education: [education('B.Tech', 'Computer Science', 'Delhi Technological University', '2018')],
    experience: [
      experience('Senior Frontend Developer', 'PixelCraft Technologies', 'Jan 2021', 'Present', 'Build and maintain customer-facing dashboards in React and TypeScript. Improved page load time by 32% and mentor two junior developers.'),
      experience('Frontend Developer', 'CloudKart', 'Jul 2018', 'Dec 2020', 'Developed responsive storefront pages and reusable UI components. Worked with designers to improve mobile checkout completion.'),
    ],
    yearsExperience: 6,
    stage: 'interview',
    source: 'sample',
    isSample: true,
    createdAt: daysAgo(12, 2),
    updatedAt: daysAgo(0, 3),
    resumeFileName: 'Ananya-Sharma-Resume.pdf',
    resumeFileSize: 184_320,
  },
  {
    id: 'sample-cand-rohan',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    phone: '+91 91234 56780',
    location: 'Pune, Maharashtra',
    title: 'Data Analyst',
    summary: 'Data analyst with four years of experience turning business questions into clear reports and dashboards. Strong in SQL, Excel and Power BI, with a practical approach to data quality.',
    skills: ['SQL', 'Python', 'Power BI', 'Excel', 'Data Visualization', 'Tableau', 'Statistics'],
    education: [
      education('MCA', 'Computer Applications', 'Savitribai Phule Pune University', '2020'),
      education('B.Sc', 'Statistics', 'Fergusson College, Pune', '2017'),
    ],
    experience: [
      experience('Data Analyst', 'Nimbus Retail', 'Aug 2021', 'Present', 'Create weekly sales and inventory reports in Power BI. Automated recurring SQL checks and reduced manual reporting time by 40%.'),
      experience('Junior Analyst', 'MarketMinds Analytics', 'Jun 2020', 'Jul 2021', 'Prepared client dashboards and cleaned survey data in Excel and Python.'),
    ],
    yearsExperience: 4,
    stage: 'screening',
    source: 'sample',
    isSample: true,
    createdAt: daysAgo(9, 5),
    updatedAt: daysAgo(1, 2),
    resumeFileName: 'Rohan-Mehta-Resume.pdf',
    resumeFileSize: 126_500,
  },
  {
    id: 'sample-cand-kavya',
    name: 'Kavya Nair',
    email: 'kavya.nair@example.com',
    phone: '+91 99887 76655',
    location: 'Gurugram, Haryana',
    title: 'HR Executive',
    summary: 'HR professional with three years of experience across recruitment, onboarding and payroll support. Known for keeping candidates informed and hiring managers organised.',
    skills: ['Recruitment', 'HR Operations', 'Payroll', 'Communication', 'Excel', 'Employee Engagement', 'Onboarding'],
    education: [
      education('MBA', 'Human Resources', 'Symbiosis Institute of Business Management', '2021'),
      education('B.Com', 'Commerce', 'Hansraj College, Delhi', '2018'),
    ],
    experience: [
      experience('HR Executive', 'PeopleFirst Consulting', 'Sep 2021', 'Present', 'Manage end-to-end hiring for sales and operations roles. Coordinate onboarding, offer letters and monthly payroll inputs for 120 employees.'),
      experience('HR Intern', 'TalentBridge Services', 'Jan 2021', 'Aug 2021', 'Supported interview scheduling, candidate follow-ups and HR records.'),
    ],
    yearsExperience: 3,
    stage: 'offer',
    source: 'sample',
    isSample: true,
    createdAt: daysAgo(6, 4),
    updatedAt: daysAgo(0, 6),
    resumeFileName: 'Kavya-Nair-Resume.docx',
    resumeFileSize: 94_800,
  },
  {
    id: 'sample-cand-arjun',
    name: 'Arjun Singh',
    email: 'arjun.singh@example.com',
    phone: '+91 90123 45678',
    location: 'Noida, Uttar Pradesh',
    title: 'Backend Developer',
    summary: 'Backend developer with five years of experience building reliable APIs and internal services. Works with Node.js, TypeScript and PostgreSQL, with a focus on simple, maintainable systems.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs', 'AWS', 'Docker', 'Redis', 'Git'],
    education: [education('B.Tech', 'Information Technology', 'Amity University, Noida', '2019')],
    experience: [
      experience('Backend Developer', 'Sarvam Systems', 'Mar 2021', 'Present', 'Design Node.js and PostgreSQL services for a logistics platform. Added monitoring and reduced failed background jobs by 28%.'),
      experience('Software Engineer', 'Inventa Labs', 'Aug 2019', 'Feb 2021', 'Built REST APIs and supported AWS deployments for a small product team.'),
    ],
    yearsExperience: 5,
    stage: 'new',
    source: 'sample',
    isSample: true,
    createdAt: daysAgo(3, 3),
    updatedAt: daysAgo(2, 1),
    resumeFileName: 'Arjun-Singh-Resume.pdf',
    resumeFileSize: 143_900,
  },
];

const sampleJobs: Job[] = [
  {
    id: 'sample-job-frontend',
    title: 'Frontend Developer',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka',
    employmentType: 'Full-time',
    description: 'We are looking for a Frontend Developer to build clear, responsive web experiences for our customers. You will work with designers and backend engineers to ship new features, improve performance and maintain reusable UI components.\n\nThe role suits someone who has strong React and TypeScript fundamentals, cares about accessibility and can work with product teams in a fast-moving environment.',
    requiredSkills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
    preferredSkills: ['Next.js', 'Tailwind CSS', 'Git'],
    minExperience: 3,
    maxExperience: 6,
    educationRequirement: 'B.Tech / BCA / MCA',
    status: 'active',
    isSample: true,
    createdAt: daysAgo(18, 3),
    updatedAt: daysAgo(2, 2),
  },
  {
    id: 'sample-job-data',
    title: 'Data Analyst',
    department: 'Analytics',
    location: 'Pune, Maharashtra',
    employmentType: 'Full-time',
    description: 'We need a Data Analyst who can turn business data into simple reports and useful dashboards. You will write SQL queries, maintain recurring reports and work with sales and operations teams to understand what the numbers mean.\n\nStrong Excel and Power BI skills are important. You should be comfortable checking data quality and explaining findings to non-technical colleagues.',
    requiredSkills: ['SQL', 'Python', 'Excel', 'Power BI'],
    preferredSkills: ['Tableau', 'Data Visualization', 'Statistics'],
    minExperience: 2,
    maxExperience: 5,
    educationRequirement: 'B.Sc / BCA / MCA',
    status: 'active',
    isSample: true,
    createdAt: daysAgo(14, 6),
    updatedAt: daysAgo(1, 6),
  },
  {
    id: 'sample-job-hr',
    title: 'HR Executive',
    department: 'Human Resources',
    location: 'Gurugram, Haryana',
    employmentType: 'Full-time',
    description: 'We are hiring an HR Executive to support recruitment, onboarding and day-to-day HR operations. You will coordinate interviews, keep candidate records up to date, prepare offer documents and help with monthly payroll inputs.\n\nThis role is a good fit for someone who is organised, comfortable talking to candidates and careful with confidential information.',
    requiredSkills: ['Recruitment', 'HR Operations', 'Communication'],
    preferredSkills: ['Payroll', 'Excel', 'Employee Engagement'],
    minExperience: 2,
    maxExperience: 4,
    educationRequirement: 'MBA / BBA / B.Com',
    status: 'active',
    isSample: true,
    createdAt: daysAgo(10, 2),
    updatedAt: daysAgo(3, 1),
  },
  {
    id: 'sample-job-backend',
    title: 'Backend Developer',
    department: 'Engineering',
    location: 'Noida, Uttar Pradesh',
    employmentType: 'Full-time',
    description: 'Our engineering team is looking for a Backend Developer to build and maintain APIs for internal and customer-facing products. You will work with Node.js, TypeScript and PostgreSQL, review code with the team and help improve service reliability.\n\nExperience with AWS and Docker is useful. We value clear communication, practical problem solving and a willingness to learn.',
    requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs'],
    preferredSkills: ['AWS', 'Docker', 'Redis'],
    minExperience: 3,
    maxExperience: 6,
    educationRequirement: 'B.Tech / BCA / MCA',
    status: 'draft',
    isSample: true,
    createdAt: daysAgo(7, 4),
    updatedAt: daysAgo(4, 3),
  },
];

function buildResume(candidate: SeedCandidate): string {
  const lines = [
    candidate.name,
    candidate.title ?? 'Professional',
    `${candidate.email ?? ''} | ${candidate.phone ?? ''} | ${candidate.location ?? ''}`,
    '',
    'PROFESSIONAL SUMMARY',
    candidate.summary ?? '',
    '',
    'CORE SKILLS',
    candidate.skills.join(' · '),
    '',
    'PROFESSIONAL EXPERIENCE',
  ];
  for (const role of candidate.experience) {
    lines.push(`${role.title} — ${role.company ?? ''}`);
    lines.push(`${role.start ?? ''} – ${role.end ?? ''}`);
    if (role.description) lines.push(role.description);
    lines.push('');
  }
  lines.push('EDUCATION');
  for (const entry of candidate.education) {
    lines.push(`${entry.degree}${entry.field ? ' in ' + entry.field : ''}${entry.institution ? ' — ' + entry.institution : ''}${entry.year ? ' · ' + entry.year : ''}`);
  }
  return lines.join('\n');
}

function workspaceIsEmpty(database: DatabaseSync): boolean {
  const count = database.prepare('SELECT COUNT(*) AS count FROM candidates').get() as { count: number };
  const jobCount = database.prepare('SELECT COUNT(*) AS count FROM jobs').get() as { count: number };
  return Number(count.count) === 0 && Number(jobCount.count) === 0;
}

const demoMatches = [
  { candidateId: 'sample-cand-ananya', jobId: 'sample-job-frontend', days: 1 },
  { candidateId: 'sample-cand-ananya', jobId: 'sample-job-backend', days: 4 },
  { candidateId: 'sample-cand-rohan', jobId: 'sample-job-data', days: 0 },
  { candidateId: 'sample-cand-rohan', jobId: 'sample-job-frontend', days: 6 },
  { candidateId: 'sample-cand-kavya', jobId: 'sample-job-hr', days: 2 },
  { candidateId: 'sample-cand-arjun', jobId: 'sample-job-backend', days: 1 },
  { candidateId: 'sample-cand-arjun', jobId: 'sample-job-data', days: 5 },
];

export function seedDemoData(database: DatabaseSync): void {
  if (!workspaceIsEmpty(database)) return;
  const insertCandidate = database.prepare(
    `INSERT INTO candidates (id, name, email, phone, location, title, summary, skills, education, experience, years_experience, resume_text, stage, source, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertResume = database.prepare(
    `INSERT INTO resumes (id, candidate_id, original_name, stored_name, file_type, file_size, status, error_message, text_length, is_sample, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertJob = database.prepare(
    `INSERT INTO jobs (id, title, department, location, employment_type, description, required_skills, preferred_skills, min_experience, max_experience, education_requirement, status, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMatch = database.prepare(
    `INSERT INTO matches (id, candidate_id, job_id, overall_score, skills_score, experience_score, education_score, keyword_score, matched_skills, missing_skills, missing_required_skills, strengths, gaps, review_flags, explanation, weights, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertActivity = database.prepare(
    `INSERT INTO activities (id, type, message, candidate_id, job_id, meta, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const candidateMap = new Map(sampleCandidates.map((candidate) => [candidate.id, candidate]));
  const jobMap = new Map(sampleJobs.map((job) => [job.id, job]));

  database.exec('BEGIN');
  try {
    for (const candidate of sampleCandidates) {
      const resumeText = buildResume(candidate);
      insertCandidate.run(
        candidate.id,
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.location,
        candidate.title,
        candidate.summary,
        JSON.stringify(candidate.skills),
        JSON.stringify(candidate.education),
        JSON.stringify(candidate.experience),
        candidate.yearsExperience,
        resumeText,
        candidate.stage,
        candidate.source,
        1,
        candidate.createdAt,
        candidate.updatedAt,
      );
      insertResume.run(
        `resume-${candidate.id}`,
        candidate.id,
        candidate.resumeFileName,
        null,
        candidate.resumeFileName.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
        candidate.resumeFileSize,
        'processed',
        null,
        resumeText.length,
        1,
        candidate.createdAt,
      );
    }
    for (const job of sampleJobs) {
      const salaryMin = job.id === 'sample-job-frontend' ? 1200000 : job.id === 'sample-job-data' ? 850000 : job.id === 'sample-job-hr' ? 600000 : 1400000;
      const salaryMax = job.id === 'sample-job-frontend' ? 1800000 : job.id === 'sample-job-data' ? 1300000 : job.id === 'sample-job-hr' ? 950000 : 2200000;
      const workMode = job.id === 'sample-job-frontend' ? 'Hybrid' : job.id === 'sample-job-backend' ? 'Remote' : 'On-site';
      const company = job.id === 'sample-job-frontend' ? 'PixelCraft India' : job.id === 'sample-job-data' ? 'Nimbus Analytics' : job.id === 'sample-job-hr' ? 'PeopleFirst Advisory' : 'Sarvam Cloud';
      insertJob.run(
        job.id,
        job.title,
        job.department,
        job.location,
        job.employmentType,
        job.description,
        JSON.stringify(job.requiredSkills),
        JSON.stringify(job.preferredSkills),
        job.minExperience,
        job.maxExperience,
        job.educationRequirement,
        job.status,
        1,
        job.createdAt,
        job.updatedAt,
      );
      database
        .prepare('UPDATE jobs SET company = ?, work_mode = ?, salary_min_inr = ?, salary_max_inr = ? WHERE id = ?')
        .run(company, workMode, salaryMin, salaryMax, job.id);
    }
    for (const item of demoMatches) {
      const candidate = candidateMap.get(item.candidateId);
      const job = jobMap.get(item.jobId);
      if (!candidate || !job) continue;
      const result = calculateMatch(candidate, job, DEFAULT_WEIGHTS);
      insertMatch.run(
        randomUUID(),
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
        JSON.stringify(result.explanation),
        JSON.stringify(result.weights),
        'deterministic',
        daysAgo(item.days, 1),
      );
    }
    const activityRows = [
      ['resume_processed', "Ananya Sharma's resume was screened for Frontend Developer.", 'sample-cand-ananya', 'sample-job-frontend', 0],
      ['match_run', 'Hiring matches were refreshed for Data Analyst.', 'sample-cand-rohan', 'sample-job-data', 1],
      ['stage_changed', 'Kavya Nair moved to the Offer stage.', 'sample-cand-kavya', 'sample-job-hr', 2],
      ['resume_processed', "Arjun Singh's resume was screened for Backend Developer.", 'sample-cand-arjun', 'sample-job-backend', 3],
      ['match_run', 'Frontend Developer matches were reviewed.', 'sample-cand-ananya', 'sample-job-frontend', 4],
      ['job_created', 'HR Executive job opening was created.', null, 'sample-job-hr', 8],
    ];
    for (const [type, message, candidateId, jobId, days] of activityRows) {
      insertActivity.run(
        randomUUID(),
        String(type),
        String(message),
        candidateId ?? null,
        jobId ?? null,
        JSON.stringify({ sample: true }),
        1,
        daysAgo(Number(days), 3),
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  dedupeSkills(sampleCandidates.flatMap((candidate) => candidate.skills));
}
