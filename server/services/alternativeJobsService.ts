import type { AlternativeJobRecommendation, Candidate, Job } from '../types.js';
import { calculateMatch } from './matchingEngine.js';
import { canonicalSkill } from './skills.js';

const SKILL_BRIDGES: Record<string, { related: string[]; projectIdea: string; demoTip: string }> = {
  docker: {
    related: ['Node.js', 'Express', 'Python', 'FastAPI', 'CI/CD'],
    projectIdea: 'Containerize an existing Node.js or Python REST API with a multi-stage Dockerfile and Docker Compose.',
    demoTip: 'Publish the Dockerfile and a brief README showing local container startup and health checks.',
  },
  kubernetes: {
    related: ['Docker', 'AWS', 'CI/CD', 'Linux'],
    projectIdea: 'Deploy a 2-service app to a local kind/minikube cluster with Deployment, Service, and readiness probes.',
    demoTip: 'Document your YAML manifests and rollback steps in a Git repository.',
  },
  aws: {
    related: ['Docker', 'Node.js', 'PostgreSQL', 'Linux'],
    projectIdea: 'Deploy a serverless API or containerized service using S3, RDS/SQLite backup, and IAM least-privilege roles.',
    demoTip: 'Include an architecture diagram and cost/security checklist.',
  },
  typescript: {
    related: ['JavaScript', 'React', 'Node.js'],
    projectIdea: 'Migrate a JavaScript frontend or Express API to strict TypeScript with Zod schema validation.',
    demoTip: 'Show zero `any` types and full type-safe API responses.',
  },
  react: {
    related: ['JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Next.js'],
    projectIdea: 'Build an accessible, responsive dashboard with reusable form components and state management.',
    demoTip: 'Deploy a live preview and include component tests.',
  },
  'node.js': {
    related: ['JavaScript', 'TypeScript', 'Express', 'REST APIs', 'SQL'],
    projectIdea: 'Create a REST API with authentication, input validation, SQLite/PostgreSQL persistence, and integration tests.',
    demoTip: 'Share Postman/OpenAPI examples and Vitest/Jest test coverage.',
  },
  sql: {
    related: ['PostgreSQL', 'MySQL', 'SQLite', 'Python', 'Excel'],
    projectIdea: 'Design a normalized relational schema with indexed queries, CTEs, and cohort retention reports.',
    demoTip: 'Publish SQL query notebooks and explain execution plan improvements.',
  },
  python: {
    related: ['SQL', 'Pandas', 'NumPy', 'FastAPI', 'Excel'],
    projectIdea: 'Build an automated data cleaning & reporting pipeline using Python, Pandas, and SQLite.',
    demoTip: 'Include unit tests and sample CSV-to-dashboard outputs.',
  },
  'power bi': {
    related: ['Excel', 'SQL', 'Tableau', 'Data Visualization'],
    projectIdea: 'Create an executive sales & operations dashboard from public Indian retail datasets with DAX measures.',
    demoTip: 'Export screenshots and document KPI definitions.',
  },
  'machine learning': {
    related: ['Python', 'Pandas', 'NumPy', 'scikit-learn', 'SQL'],
    projectIdea: 'Train and evaluate an interpretable churn or salary-band prediction model with cross-validation.',
    demoTip: 'Show feature importance and precision/recall tradeoffs clearly.',
  },
};

export function bridgeForSkill(skill: string): {
  missingSkill: string;
  projectIdea: string;
  demonstrationTip: string;
} {
  const key = canonicalSkill(skill).toLowerCase();
  const known = SKILL_BRIDGES[key];
  if (known) {
    return {
      missingSkill: canonicalSkill(skill),
      projectIdea: known.projectIdea,
      demonstrationTip: known.demoTip,
    };
  }
  return {
    missingSkill: canonicalSkill(skill),
    projectIdea: `Build a focused mini-project applying ${canonicalSkill(skill)} to a real Indian business or developer workflow.`,
    demonstrationTip: `Document problem statement, architecture, and measurable outcomes in your portfolio or GitHub README.`,
  };
}

function findTransferableSkills(candidateSkills: string[], missingSkills: string[]): string[] {
  const candSet = new Set(candidateSkills.map((s) => canonicalSkill(s).toLowerCase()));
  const transferable: string[] = [];
  for (const missing of missingSkills) {
    const key = canonicalSkill(missing).toLowerCase();
    const bridge = SKILL_BRIDGES[key];
    if (!bridge) continue;
    for (const rel of bridge.related) {
      if (candSet.has(rel.toLowerCase()) && !transferable.includes(rel)) {
        transferable.push(rel);
      }
    }
  }
  return transferable.slice(0, 5);
}

export function recommendAlternativeJobs(params: {
  candidate: Candidate;
  jobs: Job[];
  savedJobIds?: Set<string>;
  appliedJobIds?: Set<string>;
  excludeJobId?: string;
  limit?: number;
}): {
  recommendations: AlternativeJobRecommendation[];
  skillSuggestions: { missingSkill: string; projectIdea: string; demonstrationTip: string }[];
} {
  const { candidate, jobs, savedJobIds = new Set(), appliedJobIds = new Set(), excludeJobId, limit = 6 } = params;
  const activeJobs = jobs.filter((job) => job.status === 'active' && job.id !== excludeJobId);
  const prefs = candidate.preferences ?? {};
  const preferredLocs = (prefs.preferredLocations ?? []).map((l) => l.toLowerCase());
  const preferredModes = (prefs.preferredWorkModes ?? []).map((m) => m.toLowerCase());

  const scored: { rec: AlternativeJobRecommendation; rankScore: number }[] = [];

  for (const job of activeJobs) {
    const result = calculateMatch(candidate, job);
    const transferableSkills = findTransferableSkills(candidate.skills, result.missingSkills);
    const hasRelevantOverlap = result.matchedSkills.length > 0 || transferableSkills.length > 0 || result.overallScore >= 35;
    if (!hasRelevantOverlap) continue;

    let prefBonus = 0;
    const jobLoc = job.location.toLowerCase();
    const jobMode = (job.workMode ?? '').toLowerCase();
    if (preferredLocs.some((loc) => jobLoc.includes(loc)) || jobMode === 'remote') prefBonus += 5;
    if (preferredModes.some((mode) => jobMode === mode)) prefBonus += 4;

    const whyParts: string[] = [];
    if (result.matchedSkills.length > 0) {
      whyParts.push(`Matches ${result.matchedSkills.slice(0, 3).join(', ')}`);
    }
    if (transferableSkills.length > 0) {
      whyParts.push(`transferable background in ${transferableSkills.slice(0, 3).join(', ')}`);
    }
    if (job.minExperience <= (candidate.yearsExperience || 0) + 1) {
      whyParts.push(`experience range fits (${job.minExperience}–${job.maxExperience || `${job.minExperience}+`} yrs)`);
    }
    if (prefBonus > 0) {
      whyParts.push(`aligns with your location/work-mode preferences`);
    }

    const primaryMissing = result.missingRequiredSkills[0] ?? result.missingSkills[0] ?? null;
    scored.push({
      rankScore: result.overallScore + transferableSkills.length * 4 + prefBonus,
      rec: {
        job,
        matchScore: Math.round(result.overallScore),
        matchingSkills: result.matchedSkills,
        transferableSkills,
        missingSkills: result.missingSkills,
        whyRecommended: whyParts.length
          ? `${whyParts.join('; ')}.`
          : `Adjacent opportunity with ${Math.round(result.overallScore)}% overall alignment.`,
        bridgeAction: primaryMissing ? bridgeForSkill(primaryMissing) : null,
        saved: savedJobIds.has(job.id),
        alreadyApplied: appliedJobIds.has(job.id),
      },
    });
  }

  scored.sort((a, b) => b.rankScore - a.rankScore || b.rec.matchScore - a.rec.matchScore);
  const recommendations = scored.slice(0, limit).map((item) => item.rec);

  // Build constructive skill-development suggestions even if no suitable jobs exist
  const missingCounts = new Map<string, number>();
  for (const job of activeJobs) {
    const res = calculateMatch(candidate, job);
    for (const m of res.missingRequiredSkills) {
      missingCounts.set(m, (missingCounts.get(m) ?? 0) + 1);
    }
  }
  const topMissing = [...missingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([skill]) => bridgeForSkill(skill));

  const fallbackSkills =
    topMissing.length > 0
      ? topMissing
      : ['TypeScript', 'SQL', 'Docker'].filter((s) => !candidate.skills.includes(s)).slice(0, 3).map(bridgeForSkill);

  return {
    recommendations,
    skillSuggestions: fallbackSkills,
  };
}
