import { getDb, newId, nowIso, parseJson } from '../database.js';
import type { Candidate, CandidateRoadmap, Job, RoadmapMilestone } from '../types.js';
import { bridgeForSkill } from './alternativeJobsService.js';
import { calculateMatch } from './matchingEngine.js';
import { canonicalSkill } from './skills.js';

export interface SkillGapItem {
  skill: string;
  priority: 'required' | 'preferred';
  whyItMatters: string;
  currentLevel: 'Not detected' | 'Adjacent experience';
  learningDirection: string;
  projectIdea: string;
  demonstrationTip: string;
  relatedJobCount: number;
}

export function analyzeSkillGaps(candidate: Candidate, jobs: Job[], targetJobId?: string) {
  const targetJob = targetJobId ? jobs.find((j) => j.id === targetJobId) ?? null : null;
  const activeJobs = targetJob ? [targetJob] : jobs.filter((j) => j.status === 'active');
  const candSet = new Set(candidate.skills.map((s) => canonicalSkill(s).toLowerCase()));

  const gapMap = new Map<string, { skill: string; requiredCount: number; preferredCount: number; jobTitles: string[] }>();
  for (const job of activeJobs) {
    const res = calculateMatch(candidate, job);
    for (const skill of res.missingRequiredSkills) {
      const key = canonicalSkill(skill).toLowerCase();
      const entry = gapMap.get(key) ?? { skill: canonicalSkill(skill), requiredCount: 0, preferredCount: 0, jobTitles: [] };
      entry.requiredCount += 1;
      if (!entry.jobTitles.includes(job.title)) entry.jobTitles.push(job.title);
      gapMap.set(key, entry);
    }
    for (const skill of res.missingSkills) {
      const key = canonicalSkill(skill).toLowerCase();
      if (res.missingRequiredSkills.some((r) => canonicalSkill(r).toLowerCase() === key)) continue;
      const entry = gapMap.get(key) ?? { skill: canonicalSkill(skill), requiredCount: 0, preferredCount: 0, jobTitles: [] };
      entry.preferredCount += 1;
      if (!entry.jobTitles.includes(job.title)) entry.jobTitles.push(job.title);
      gapMap.set(key, entry);
    }
  }

  const items: SkillGapItem[] = [...gapMap.values()]
    .sort((a, b) => b.requiredCount - a.requiredCount || b.preferredCount - a.preferredCount)
    .slice(0, 8)
    .map((entry) => {
      const bridge = bridgeForSkill(entry.skill);
      const hasAdjacent = candSet.size > 0 && (candidate.experience ?? []).length > 0;
      return {
        skill: entry.skill,
        priority: entry.requiredCount > 0 ? 'required' : 'preferred',
        whyItMatters:
          entry.jobTitles.length > 0
            ? `Requested across ${entry.jobTitles.slice(0, 2).join(' and ')}${entry.jobTitles.length > 2 ? ` (+${entry.jobTitles.length - 2} more)` : ''}.`
            : `Frequently requested in open ${targetJob?.title ?? 'technical'} roles.`,
        currentLevel: hasAdjacent ? 'Adjacent experience' : 'Not detected',
        learningDirection: `Review core ${entry.skill} concepts, official documentation, and production best practices before applying.`,
        projectIdea: bridge.projectIdea,
        demonstrationTip: bridge.demonstrationTip,
        relatedJobCount: entry.jobTitles.length,
      };
    });

  return {
    targetJob,
    matchedSkills: targetJob ? calculateMatch(candidate, targetJob).matchedSkills : candidate.skills,
    gaps: items,
  };
}

function defaultMilestonesForRole(targetRole: string, candidate: Candidate, gaps: SkillGapItem[]): RoadmapMilestone[] {
  const milestones: RoadmapMilestone[] = [];
  const roleLower = targetRole.toLowerCase();

  if (gaps.length > 0) {
    for (let i = 0; i < Math.min(4, gaps.length); i += 1) {
      const gap = gaps[i];
      milestones.push({
        id: `ms-${i + 1}-${gap.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: `Build practical depth in ${gap.skill}`,
        description: gap.learningDirection,
        skill: gap.skill,
        projectIdea: gap.projectIdea,
        completed: false,
      });
    }
  } else if (roleLower.includes('full stack') || roleLower.includes('developer') || roleLower.includes('engineer')) {
    milestones.push(
      {
        id: 'ms-js-ts',
        title: 'Strengthen JavaScript & TypeScript fundamentals',
        description: 'Master async patterns, strict typing, and clean error handling.',
        skill: 'TypeScript',
        projectIdea: 'Convert a React or Node module to strict TypeScript with Zod validation.',
        completed: candidate.skills.some((s) => s.toLowerCase() === 'typescript'),
      },
      {
        id: 'ms-react',
        title: 'Build accessible React UI workflows',
        description: 'Design reusable components, responsive layouts, and clear form validation.',
        skill: 'React',
        projectIdea: 'Build an interactive recruitment tracker UI with charts and keyboard support.',
        completed: candidate.skills.some((s) => s.toLowerCase() === 'react'),
      },
      {
        id: 'ms-api',
        title: 'Design secure backend REST APIs',
        description: 'Implement auth, input validation, SQLite/PostgreSQL queries, and tests.',
        skill: 'Node.js',
        projectIdea: 'Ship a tested Express API with role-based access control.',
        completed: candidate.skills.some((s) => s.toLowerCase() === 'node.js'),
      },
      {
        id: 'ms-sql',
        title: 'Practice SQL & database indexing',
        description: 'Write normalized schemas, joins, constraints, and safe migrations.',
        skill: 'SQL',
        projectIdea: 'Model an application & audit trail schema with performance indexes.',
        completed: candidate.skills.some((s) => s.toLowerCase() === 'sql' || s.toLowerCase() === 'postgresql'),
      },
    );
  } else {
    milestones.push(
      {
        id: 'ms-core-1',
        title: `Map core competencies for ${targetRole}`,
        description: 'Review job descriptions on TalentIQ and align your resume evidence with required skills.',
        skill: candidate.skills[0] || 'Core Domain',
        projectIdea: 'Add measurable outcomes to your top 2 work or academic projects.',
        completed: candidate.skills.length >= 4,
      },
      {
        id: 'ms-core-2',
        title: 'Resolve Resume Integrity Radar items',
        description: 'Ensure all work dates, descriptions, and education details are complete.',
        skill: 'Documentation',
        projectIdea: 'Run Integrity Radar on your latest resume and address any missing details.',
        completed: (candidate.experience ?? []).length > 0 && (candidate.education ?? []).length > 0,
      },
      {
        id: 'ms-core-3',
        title: 'Complete a portfolio case study',
        description: 'Demonstrate end-to-end execution with problem framing, constraints, and results.',
        skill: 'Portfolio Evidence',
        projectIdea: 'Publish a concise 1-page case study or repository README.',
        completed: (candidate.projects ?? []).length > 0,
      },
    );
  }

  milestones.push({
    id: 'ms-deploy-interview',
    title: `Complete mock interview & portfolio check for ${targetRole}`,
    description: 'Practice technical and behavioral questions and prepare STAR stories tied to your resume.',
    skill: 'Interview Readiness',
    projectIdea: 'Use TalentIQ Interview Prep checklist to rehearse 5 role-specific questions.',
    completed: false,
  });

  return milestones;
}

interface RoadmapRow {
  id: string;
  user_id: string;
  target_role: string;
  milestones_json: string;
  created_at: string;
  updated_at: string;
}

export function getOrGenerateRoadmap(userId: string, candidate: Candidate, jobs: Job[], targetRoleInput?: string): CandidateRoadmap {
  const database = getDb();
  const desiredRole = targetRoleInput?.trim() || candidate.preferences?.targetRoles?.[0] || candidate.title || 'Full Stack Developer';
  const existing = database
    .prepare('SELECT * FROM candidate_roadmaps WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(userId) as RoadmapRow | undefined;

  if (existing && (!targetRoleInput || existing.target_role.toLowerCase() === desiredRole.toLowerCase())) {
    return {
      id: existing.id,
      userId: existing.user_id,
      targetRole: existing.target_role,
      milestones: parseJson<RoadmapMilestone[]>(existing.milestones_json, []),
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const matchedJob = jobs.find((j) => j.title.toLowerCase().includes(desiredRole.toLowerCase()));
  const gapResult = analyzeSkillGaps(candidate, jobs, matchedJob?.id);
  const milestones = defaultMilestonesForRole(desiredRole, candidate, gapResult.gaps);
  const id = existing?.id ?? newId();
  const ts = nowIso();

  if (existing) {
    database
      .prepare('UPDATE candidate_roadmaps SET target_role = ?, milestones_json = ?, updated_at = ? WHERE id = ?')
      .run(desiredRole, JSON.stringify(milestones), ts, existing.id);
  } else {
    database
      .prepare('INSERT INTO candidate_roadmaps (id, user_id, target_role, milestones_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, userId, desiredRole, JSON.stringify(milestones), ts, ts);
  }

  return {
    id,
    userId,
    targetRole: desiredRole,
    milestones,
    createdAt: existing?.created_at ?? ts,
    updatedAt: ts,
  };
}

export function toggleRoadmapMilestone(userId: string, milestoneId: string, completed: boolean): CandidateRoadmap {
  const database = getDb();
  const existing = database
    .prepare('SELECT * FROM candidate_roadmaps WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(userId) as RoadmapRow | undefined;
  if (!existing) {
    throw new Error('Roadmap not initialized.');
  }
  const milestones = parseJson<RoadmapMilestone[]>(existing.milestones_json, []).map((item) =>
    item.id === milestoneId ? { ...item, completed } : item,
  );
  const ts = nowIso();
  database
    .prepare('UPDATE candidate_roadmaps SET milestones_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(milestones), ts, existing.id);
  return {
    id: existing.id,
    userId: existing.user_id,
    targetRole: existing.target_role,
    milestones,
    createdAt: existing.created_at,
    updatedAt: ts,
  };
}

export interface InterviewPrepPack {
  roleTitle: string;
  jobId: string | null;
  technicalQuestions: { question: string; focusSkill: string; answerStructure: string }[];
  behavioralQuestions: { question: string; competency: string; answerStructure: string }[];
  areasToRevise: string[];
  practiceChecklist: { id: string; label: string }[];
  source: 'deterministic';
}

export function buildInterviewPrep(candidate: Candidate, job: Job | null): InterviewPrepPack {
  const roleTitle = job?.title ?? candidate.title ?? 'Software / Business Role';
  const focusSkills = job
    ? [...new Set([...job.requiredSkills, ...job.preferredSkills])].slice(0, 5)
    : candidate.skills.slice(0, 5);
  const missing = job ? calculateMatch(candidate, job).missingRequiredSkills : [];

  const technicalQuestions = (focusSkills.length ? focusSkills : ['Core Domain Fundamentals']).slice(0, 4).map((skill) => ({
    question: `Walk through a concrete project or task where you applied ${skill} for ${roleTitle}. What tradeoffs did you evaluate?`,
    focusSkill: skill,
    answerStructure: 'Context (problem & scale) -> Approach (why this design/tool) -> Edge cases & testing -> Measurable result.',
  }));

  if (missing.length > 0) {
    technicalQuestions.push({
      question: `This role lists ${missing[0]} among its requirements, which was not explicit in your resume. How would you ramp up or apply adjacent experience?`,
      focusSkill: missing[0],
      answerStructure: 'Acknowledge gap honestly -> Connect transferable concepts you already use -> Describe a concrete hands-on step.',
    });
  }

  const behavioralQuestions = [
    {
      question: 'Tell me about a time a deadline or requirement shifted unexpectedly. How did you reprioritize and communicate?',
      competency: 'Ownership & Adaptability',
      answerStructure: 'STAR: Situation -> Task -> Action (tradeoff communication) -> Result.',
    },
    {
      question: 'Describe a disagreement with a teammate or stakeholder over an implementation choice. How did you resolve it?',
      competency: 'Collaboration',
      answerStructure: 'STAR: Focus on objective criteria, data/prototypes used, and team alignment.',
    },
    {
      question: 'What is a mistake or production/delivery issue you caught late, and what safeguard did you add afterward?',
      competency: 'Quality & Learning',
      answerStructure: 'STAR: Root cause -> Fix -> Preventive test or process improvement.',
    },
  ];

  const areasToRevise = [
    ...(missing.length > 0 ? missing.map((s) => `${s} fundamentals & hands-on workflow`) : []),
    ...focusSkills.slice(0, 3).map((s) => `Deep-dive examples for ${s}`),
    'Quantified impact & architecture tradeoffs from your recent projects',
  ].slice(0, 5);

  const practiceChecklist = [
    { id: 'chk-1', label: 'Prepare a crisp 90-second career summary tailored to this role' },
    { id: 'chk-2', label: 'Review 2 projects in detail (architecture, bottlenecks, testing)' },
    { id: 'chk-3', label: 'Prepare honest bridge examples for any missing job requirements' },
    { id: 'chk-4', label: 'Draft 3 thoughtful questions to ask the interviewer about team & goals' },
  ];

  return {
    roleTitle,
    jobId: job?.id ?? null,
    technicalQuestions,
    behavioralQuestions,
    areasToRevise,
    practiceChecklist,
    source: 'deterministic',
  };
}
