import type {
  Candidate,
  Job,
  MatchExplanation,
  MatchFactor,
  MatchResult,
  MatchWeights,
} from '../types.js';
import { canonicalSkill, dedupeSkills } from './skills.js';
import { buildMatchEvidence } from './evidenceService.js';

export const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 55,
  experience: 25,
  education: 10,
  keywords: 10,
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'our', 'are', 'will',
  'have', 'has', 'was', 'were', 'not', 'but', 'all', 'any', 'can', 'may', 'who', 'how', 'its',
  'into', 'than', 'then', 'them', 'they', 'their', 'about', 'across', 'also', 'using', 'use',
  'work', 'working', 'role', 'team', 'teams', 'join', 'help', 'make', 'build', 'building',
  'strong', 'experience', 'experienced', 'skills', 'ability', 'able', 'plus', 'preferred',
  'required', 'requirements', 'responsibilities', 'candidate', 'candidates', 'job', 'position',
  'company', 'opportunity', 'including', 'include', 'well', 'more', 'most', 'other', 'such',
  'within', 'where', 'when', 'what', 'while', 'would', 'should', 'could', 'years', 'year',
  'looking', 'ideal', 'successful', 'you\'ll', 'we\'re', 'our', 'new', 'one', 'two', 'three',
  'across', 'high', 'highly', 'great', 'good', 'deep', 'solid', 'proven', 'relevant',
]);

const DEGREE_LEVELS: { level: number; label: string; pattern: RegExp }[] = [
  { level: 5, label: 'Doctorate', pattern: /(?<![a-z0-9])(ph\.?\s?d|doctorate|doctoral)(?![a-z0-9])/i },
  { level: 4, label: "Master's degree", pattern: /(?<![a-z0-9])(master(?:'s)?|m\.?s\.?|msc|m\.?tech|mba|m\.?a\.?|graduate degree)(?![a-z0-9])/i },
  { level: 3, label: "Bachelor's degree", pattern: /(?<![a-z0-9])(bachelor(?:'s)?|b\.?s\.?|b\.?a\.?|b\.?tech|b\.?e\.?|undergraduate|b\.?sc)(?![a-z0-9])/i },
  { level: 1, label: 'High school', pattern: /(?<![a-z0-9])(high school|secondary school|ged)(?![a-z0-9])/i },
  { level: 2, label: 'Associate degree / diploma', pattern: /(?<![a-z0-9])(associate|diploma|foundation degree)(?![a-z0-9])/i },
];

export function degreeLevel(value: string | undefined | null): number {
  if (!value) return 0;
  for (const degree of DEGREE_LEVELS) {
    if (degree.pattern.test(value)) return degree.level;
  }
  return 0;
}

export function degreeLabel(level: number): string {
  return DEGREE_LEVELS.find((degree) => degree.level === level)?.label ?? 'Not detected';
}

export function highestCandidateEducation(candidate: Pick<Candidate, 'education'>): { level: number; label: string } {
  let best = 0;
  for (const entry of candidate.education ?? []) {
    best = Math.max(best, degreeLevel(`${entry.degree ?? ''} ${entry.field ?? ''}`));
  }
  return { level: best, label: degreeLabel(best) };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normaliseWeights(weights?: Partial<MatchWeights>): MatchWeights {
  const merged: MatchWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const total = merged.skills + merged.experience + merged.education + merged.keywords;
  if (!Number.isFinite(total) || total <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    skills: round((merged.skills / total) * 100, 1),
    experience: round((merged.experience / total) * 100, 1),
    education: round((merged.education / total) * 100, 1),
    keywords: round((merged.keywords / total) * 100, 1),
  };
}

function keywordTerms(job: Job): string[] {
  const source = [
    job.description,
    ...(job.requiredSkills ?? []),
    ...(job.preferredSkills ?? []),
  ].join(' ').toLowerCase();
  const counts = new Map<string, number>();
  for (const token of source.match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 45)
    .map(([term]) => term);
}

function candidateKeywordCorpus(candidate: Candidate): string {
  const experienceText = (candidate.experience ?? [])
    .map((entry) => [entry.title, entry.company, entry.description].filter(Boolean).join(' '))
    .join(' ');
  return [
    candidate.resumeText ?? '',
    candidate.summary ?? '',
    candidate.title ?? '',
    ...(candidate.skills ?? []),
    experienceText,
  ].join(' ').toLowerCase();
}

function matchSkillSets(candidateSkills: string[], job: Job) {
  const candidateSet = new Set(candidateSkills.map((skill) => canonicalSkill(skill).toLowerCase()));
  const required = dedupeSkills(job.requiredSkills ?? []);
  const preferred = dedupeSkills(job.preferredSkills ?? []);
  const matchedRequired = required.filter((skill) => candidateSet.has(canonicalSkill(skill).toLowerCase()));
  const missingRequired = required.filter((skill) => !candidateSet.has(canonicalSkill(skill).toLowerCase()));
  const matchedPreferred = preferred.filter((skill) => candidateSet.has(canonicalSkill(skill).toLowerCase()));
  const missingPreferred = preferred.filter((skill) => !candidateSet.has(canonicalSkill(skill).toLowerCase()));
  return {
    required,
    preferred,
    matchedRequired,
    missingRequired,
    matchedPreferred,
    missingPreferred,
  };
}

export function calculateMatch(
  candidate: Candidate,
  job: Job,
  weightsInput?: Partial<MatchWeights>,
): MatchResult {
  const weights = normaliseWeights(weightsInput);
  const skillMatch = matchSkillSets(candidate.skills ?? [], job);
  const candidateYears = Math.max(0, Number(candidate.yearsExperience) || 0);
  const requiredYears = Math.max(0, Number(job.minExperience) || 0);

  let skillsScore: number;
  if (skillMatch.required.length === 0 && skillMatch.preferred.length === 0) {
    skillsScore = 100;
  } else if (skillMatch.required.length === 0) {
    skillsScore = clamp((skillMatch.matchedPreferred.length / skillMatch.preferred.length) * 100);
  } else if (skillMatch.preferred.length === 0) {
    skillsScore = clamp((skillMatch.matchedRequired.length / skillMatch.required.length) * 100);
  } else {
    const requiredCoverage = skillMatch.matchedRequired.length / skillMatch.required.length;
    const preferredCoverage = skillMatch.matchedPreferred.length / skillMatch.preferred.length;
    skillsScore = clamp((requiredCoverage * 0.8 + preferredCoverage * 0.2) * 100);
  }

  let experienceScore: number;
  let experienceDetail: string;
  if (requiredYears <= 0) {
    experienceScore = 100;
    experienceDetail = 'No minimum experience was specified, so this factor is neutral.';
  } else {
    const ratio = candidateYears / requiredYears;
    experienceScore = clamp(ratio >= 1 ? 100 : ratio * 95);
    experienceDetail = `${round(candidateYears, 1)} years detected against a ${round(requiredYears, 1)}-year minimum.`;
  }

  const candidateEducation = highestCandidateEducation(candidate);
  const requiredEducationLevel = degreeLevel(job.educationRequirement);
  let educationScore: number;
  let educationDetail: string;
  if (requiredEducationLevel === 0) {
    educationScore = 100;
    educationDetail = 'No formal education level was specified, so this factor is neutral.';
  } else if (candidateEducation.level >= requiredEducationLevel) {
    educationScore = 100;
    educationDetail = `${candidateEducation.label} detected; the role asks for ${degreeLabel(requiredEducationLevel)}.`;
  } else if (candidateEducation.level === 0) {
    educationScore = 20;
    educationDetail = `No formal education was detected; the role asks for ${degreeLabel(requiredEducationLevel)}. Review manually.`;
  } else {
    const gap = requiredEducationLevel - candidateEducation.level;
    educationScore = gap === 1 ? 60 : 25;
    educationDetail = `${candidateEducation.label} detected; the role asks for ${degreeLabel(requiredEducationLevel)}.`;
  }

  const terms = keywordTerms(job);
  const corpus = candidateKeywordCorpus(candidate);
  const matchedTerms = terms.filter((term) => corpus.includes(term));
  const keywordScore = terms.length === 0 ? 100 : clamp((matchedTerms.length / terms.length) * 100);

  const overallScore = clamp(
    (skillsScore * weights.skills +
      experienceScore * weights.experience +
      educationScore * weights.education +
      keywordScore * weights.keywords) /
      100,
  );

  const matchedSkills = dedupeSkills([...skillMatch.matchedRequired, ...skillMatch.matchedPreferred]);
  const missingSkills = dedupeSkills([...skillMatch.missingRequired, ...skillMatch.missingPreferred]);

  const strengths: string[] = [];
  if (skillMatch.required.length > 0) {
    strengths.push(`Covers ${skillMatch.matchedRequired.length} of ${skillMatch.required.length} required skills.`);
  }
  if (skillMatch.matchedPreferred.length > 0) {
    strengths.push(`Brings preferred skills: ${skillMatch.matchedPreferred.slice(0, 4).join(', ')}.`);
  }
  if (requiredYears > 0 && candidateYears >= requiredYears) {
    strengths.push(`Meets the experience threshold with ${round(candidateYears, 1)} years.`);
  }
  if (requiredEducationLevel > 0 && candidateEducation.level >= requiredEducationLevel) {
    strengths.push(`Meets the ${degreeLabel(requiredEducationLevel).toLowerCase()} requirement.`);
  }
  if (matchedTerms.length >= Math.ceil(terms.length * 0.6) && terms.length > 0) {
    strengths.push('Strong terminology overlap with the job description.');
  }
  if (strengths.length === 0) {
    strengths.push('Some relevant background is present; open the profile to review context.');
  }

  const gaps: string[] = [];
  if (skillMatch.missingRequired.length > 0) {
    gaps.push(`Missing required skills: ${skillMatch.missingRequired.slice(0, 6).join(', ')}.`);
  }
  if (skillMatch.missingPreferred.length > 0) {
    gaps.push(`Preferred skills not detected: ${skillMatch.missingPreferred.slice(0, 5).join(', ')}.`);
  }
  if (requiredYears > 0 && candidateYears < requiredYears) {
    gaps.push(`Experience is ${round(Math.max(0, requiredYears - candidateYears), 1)} years below the stated minimum.`);
  }
  if (requiredEducationLevel > 0 && candidateEducation.level < requiredEducationLevel) {
    gaps.push('Formal education record does not fully meet the stated requirement.');
  }
  if (gaps.length === 0) {
    gaps.push('No material skill or requirement gaps were detected by the local engine.');
  }

  const reviewFlags: string[] = [];
  if (candidateYears === 0) {
    reviewFlags.push('No reliable work-history dates were detected. Verify experience manually.');
  }
  if (educationScore < 100 && requiredEducationLevel > 0) {
    reviewFlags.push('Education is a review flag, not an automatic disqualifier.');
  }
  if ((candidate.skills ?? []).length < 4) {
    reviewFlags.push('Few skills were detected. The resume may be sparse or image-based.');
  }
  reviewFlags.push('Scores are decision support only. A recruiter should review the full profile.');

  const experienceWeighted = round((experienceScore * weights.experience) / 100, 1);
  const factors: MatchFactor[] = [
    {
      key: 'skills',
      label: 'Skills',
      score: round(skillsScore, 1),
      weight: weights.skills,
      contribution: round((skillsScore * weights.skills) / 100, 1),
      detail: skillMatch.required.length
        ? `${skillMatch.matchedRequired.length}/${skillMatch.required.length} required and ${skillMatch.matchedPreferred.length}/${skillMatch.preferred.length} preferred skills matched.`
        : 'The job has no structured skill requirements.',
    },
    {
      key: 'experience',
      label: 'Experience',
      score: round(experienceScore, 1),
      weight: weights.experience,
      contribution: experienceWeighted,
      detail: experienceDetail,
    },
    {
      key: 'education',
      label: 'Education',
      score: round(educationScore, 1),
      weight: weights.education,
      contribution: round((educationScore * weights.education) / 100, 1),
      detail: educationDetail,
    },
    {
      key: 'keywords',
      label: 'Keyword relevance',
      score: round(keywordScore, 1),
      weight: weights.keywords,
      contribution: round((keywordScore * weights.keywords) / 100, 1),
      detail: `${matchedTerms.length} of ${terms.length} high-signal terms from the job description were found in the candidate record.`,
    },
  ];

  const explanation: MatchExplanation = {
    summary: `${candidate.name} scores ${Math.round(overallScore)}% for ${job.title}. The score combines four deterministic signals using the configured weights. It is explainable decision support, not an automated hiring decision.`,
    factors,
    methodology:
      'Local, rule-based scoring: exact normalized skill matches; stated years compared with the minimum; highest detected degree compared with the requirement; and job-description keyword coverage. No protected personal characteristics are used.',
  };

  const evidence = buildMatchEvidence({
    candidate,
    job,
    matchedSkills,
    missingSkills,
    requiredYears,
    candidateYears,
    requiredEducationLabel: requiredEducationLevel > 0 ? degreeLabel(requiredEducationLevel) : job.educationRequirement,
    candidateEducationLabel: candidateEducation.label,
  });

  return {
    overallScore: round(overallScore, 1),
    skillsScore: round(skillsScore, 1),
    experienceScore: round(experienceScore, 1),
    educationScore: round(educationScore, 1),
    keywordScore: round(keywordScore, 1),
    matchedSkills,
    missingSkills,
    missingRequiredSkills: skillMatch.missingRequired,
    strengths: strengths.slice(0, 5),
    gaps: gaps.slice(0, 5),
    reviewFlags: reviewFlags.slice(0, 3),
    evidence,
    explanation,
    weights,
  };
}
