import { describe, expect, it } from 'vitest';
import { calculateMatch, degreeLevel } from '../server/services/matchingEngine.js';
import type { Candidate, Job } from '../server/types.js';

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'candidate-1',
    name: 'Jordan Blake',
    email: 'jordan@example.com',
    phone: null,
    location: 'San Francisco, CA',
    title: 'Senior Frontend Engineer',
    summary: 'Frontend engineer who builds accessible React design systems.',
    skills: ['React.js', 'TypeScript', 'Node.js', 'GraphQL', 'CSS'],
    education: [{ degree: 'Bachelor of Science', field: 'Computer Science', institution: 'State University', year: '2018' }],
    experience: [
      {
        title: 'Senior Frontend Engineer',
        company: 'Northstar Labs',
        start: '2020',
        end: 'Present',
        description: 'Built React design systems with TypeScript and GraphQL.',
      },
    ],
    yearsExperience: 6,
    stage: 'screening',
    source: 'manual',
    isSample: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote',
    employmentType: 'Full-time',
    description:
      'Build accessible React design systems with TypeScript and GraphQL. Work with Node.js services and Kubernetes deployments.',
    requiredSkills: ['React', 'TypeScript', 'Node.js', 'Kubernetes'],
    preferredSkills: ['GraphQL', 'AWS'],
    minExperience: 4,
    maxExperience: 0,
    educationRequirement: "Bachelor's degree",
    status: 'active',
    isSample: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('deterministic matching engine', () => {
  it('explains a strong match with weighted, bounded factor scores', () => {
    const result = calculateMatch(makeCandidate(), makeJob());

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.skillsScore).toBe(70);
    expect(result.experienceScore).toBe(100);
    expect(result.educationScore).toBe(100);
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'GraphQL']));
    expect(result.missingRequiredSkills).toContain('Kubernetes');
    expect(result.explanation.factors).toHaveLength(4);
    expect(result.explanation.factors.map((factor) => factor.key)).toEqual([
      'skills',
      'experience',
      'education',
      'keywords',
    ]);
    expect(result.explanation.factors.reduce((sum, factor) => sum + factor.weight, 0)).toBeCloseTo(100, 1);
    expect(result.explanation.factors.reduce((sum, factor) => sum + factor.contribution, 0)).toBeCloseTo(
      result.overallScore,
      0,
    );
    expect(result.explanation.methodology).toMatch(/rule-based|deterministic/i);
    expect(result.explanation.methodology).toContain('No protected personal characteristics');
    expect(result.reviewFlags.length).toBeGreaterThan(0);
  });

  it('normalizes custom weights so the skills factor can drive the full score', () => {
    const result = calculateMatch(makeCandidate(), makeJob(), {
      skills: 100,
      experience: 0,
      education: 0,
      keywords: 0,
    });

    expect(result.weights).toEqual({ skills: 100, experience: 0, education: 0, keywords: 0 });
    expect(result.overallScore).toBe(result.skillsScore);
  });

  it('is deterministic and does not use candidate identity', () => {
    const first = calculateMatch(makeCandidate({ name: 'Jordan Blake' }), makeJob());
    const second = calculateMatch(makeCandidate({ name: 'Taylor Morgan' }), makeJob());
    const repeat = calculateMatch(makeCandidate({ name: 'Jordan Blake' }), makeJob());

    expect(second.overallScore).toBe(first.overallScore);
    expect(second.skillsScore).toBe(first.skillsScore);
    expect(repeat).toEqual(first);
  });

  it('penalizes insufficient experience and surfaces the gap', () => {
    const short = calculateMatch(makeCandidate({ yearsExperience: 1 }), makeJob());
    const qualified = calculateMatch(makeCandidate({ yearsExperience: 6 }), makeJob());

    expect(short.experienceScore).toBeLessThan(qualified.experienceScore);
    expect(short.overallScore).toBeLessThan(qualified.overallScore);
    expect(short.explanation.factors.find((factor) => factor.key === 'experience')?.detail).toContain('1');
    expect(short.gaps.join(' ')).toMatch(/experience/i);
  });

  it('maps degree requirements and handles candidates without a degree', () => {
    expect(degreeLevel('PhD in Computer Science')).toBe(5);
    expect(degreeLevel("Master's degree in Design")).toBe(4);
    expect(degreeLevel('B.Tech, Information Technology')).toBe(3);
    expect(degreeLevel('Diploma in Software Engineering')).toBe(2);
    expect(degreeLevel('High school diploma')).toBe(1);
    expect(degreeLevel('Certificate in UX')).toBe(0);

    const noDegree = calculateMatch(makeCandidate({ education: [] }), makeJob());
    expect(noDegree.educationScore).toBeLessThan(100);
    expect(noDegree.gaps.join(' ')).toMatch(/education|degree/i);
  });

  it('keeps scores neutral and bounded when the job has no requirements', () => {
    const result = calculateMatch(makeCandidate(), makeJob({
      requiredSkills: [],
      preferredSkills: [],
      minExperience: 0,
      educationRequirement: '',
      description: 'A generalist role focused on collaboration and product delivery.',
    }));

    for (const score of [
      result.overallScore,
      result.skillsScore,
      result.experienceScore,
      result.educationScore,
      result.keywordScore,
    ]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
    expect(result.weights.skills + result.weights.experience + result.weights.education + result.weights.keywords).toBeCloseTo(100, 1);
  });
});
