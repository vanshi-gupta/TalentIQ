import type { Candidate, EvidenceItem, Job } from '../types.js';
import { canonicalSkill, SKILL_CATALOG } from './skills.js';
import { extractSection } from './resumeParser.js';

function aliasesForSkill(skill: string): string[] {
  const canonical = canonicalSkill(skill);
  const entry = SKILL_CATALOG.find((item) => item.name.toLowerCase() === canonical.toLowerCase());
  const base = entry ? [entry.name, ...entry.aliases] : [skill, canonical];
  return [...new Set(base.map((item) => item.trim()).filter(Boolean))];
}

function findSentenceWithAny(text: string, terms: string[]): string | null {
  if (!text) return null;
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const term of terms) {
      const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![a-z0-9+#.])${escaped}(?![a-z0-9+#.])`, 'i');
      if (regex.test(lower)) {
        return sentence.slice(0, 220);
      }
    }
  }
  return null;
}

export function buildMatchEvidence(params: {
  candidate: Candidate;
  job: Job;
  matchedSkills: string[];
  missingSkills: string[];
  requiredYears: number;
  candidateYears: number;
  requiredEducationLabel: string;
  candidateEducationLabel: string;
}): EvidenceItem[] {
  const { candidate, job, matchedSkills, missingSkills, requiredYears, candidateYears, requiredEducationLabel, candidateEducationLabel } = params;
  const evidence: EvidenceItem[] = [];
  const resumeText = candidate.resumeText ?? '';
  const skillsSection = extractSection(resumeText, ['technical skills', 'core skills', 'skills', 'technologies']);
  const projectsSection = extractSection(resumeText, ['projects', 'key projects', 'academic projects']);
  const candidateSkillSet = new Set((candidate.skills ?? []).map((s) => canonicalSkill(s).toLowerCase()));

  const skillsToInspect = [...new Set([...matchedSkills, ...missingSkills])].slice(0, 14);
  for (const skill of skillsToInspect) {
    const aliases = aliasesForSkill(skill);
    const expMatch = (candidate.experience ?? []).find((entry) =>
      findSentenceWithAny(`${entry.title} ${entry.description ?? ''}`, aliases),
    );
    if (expMatch) {
      const excerpt = findSentenceWithAny(`${expMatch.title}: ${expMatch.description ?? ''}`, aliases) ?? expMatch.title;
      evidence.push({
        claim: `Skill: ${skill}`,
        category: 'skill',
        status: 'confirmed',
        source: `Experience (${expMatch.title}${expMatch.company ? ` at ${expMatch.company}` : ''})`,
        excerpt,
      });
      continue;
    }

    const projMatch = (candidate.projects ?? []).find((proj) =>
      findSentenceWithAny(`${proj.name} ${proj.description ?? ''} ${(proj.technologies ?? []).join(' ')}`, aliases),
    );
    if (projMatch) {
      evidence.push({
        claim: `Skill: ${skill}`,
        category: 'project',
        status: 'confirmed',
        source: `Project (${projMatch.name})`,
        excerpt: projMatch.description?.slice(0, 200) || `Used ${(projMatch.technologies ?? []).join(', ')}`,
      });
      continue;
    }

    const projectTextHit = findSentenceWithAny(projectsSection, aliases);
    if (projectTextHit) {
      evidence.push({
        claim: `Skill: ${skill}`,
        category: 'project',
        status: 'confirmed',
        source: 'Projects section',
        excerpt: projectTextHit,
      });
      continue;
    }

    const skillsHit = findSentenceWithAny(skillsSection, aliases);
    if (skillsHit || candidateSkillSet.has(canonicalSkill(skill).toLowerCase())) {
      evidence.push({
        claim: `Skill: ${skill}`,
        category: 'skill',
        status: 'confirmed',
        source: skillsSection ? 'Skills section' : 'Candidate skills profile',
        excerpt: skillsHit ?? `Listed in structured candidate skills: ${skill}`,
      });
      continue;
    }

    const bodyHit = findSentenceWithAny(resumeText, aliases);
    if (bodyHit) {
      evidence.push({
        claim: `Skill: ${skill}`,
        category: 'skill',
        status: 'inferred',
        source: 'Resume text',
        excerpt: bodyHit,
      });
      continue;
    }

    evidence.push({
      claim: `Skill: ${skill}`,
      category: 'skill',
      status: 'missing',
      source: 'Evidence not found in resume',
      excerpt: `Evidence not found in resume for ${skill}.`,
    });
  }

  // Experience evidence
  if ((candidate.experience ?? []).length > 0) {
    const timeline = (candidate.experience ?? [])
      .slice(0, 3)
      .map((entry) => `${entry.title}${entry.company ? ` at ${entry.company}` : ''} (${entry.start || '?'} – ${entry.end || '?'})`)
      .join('; ');
    evidence.push({
      claim: `Experience: ${candidateYears} years`,
      category: 'experience',
      status: candidateYears > 0 ? 'confirmed' : 'inferred',
      source: 'Derived from employment history',
      excerpt: requiredYears > 0 ? `${timeline}. Role asks for ${requiredYears}+ years.` : timeline,
    });
  } else if (candidateYears > 0) {
    evidence.push({
      claim: `Experience: ${candidateYears} years`,
      category: 'experience',
      status: 'inferred',
      source: 'Candidate profile summary',
      excerpt: `${candidateYears} years stated without dated employment entries. Manual verification recommended.`,
    });
  } else {
    evidence.push({
      claim: `Experience requirement (${requiredYears} years)`,
      category: 'experience',
      status: 'missing',
      source: 'Evidence not found in resume',
      excerpt: 'No dated employment history was detected in the resume.',
    });
  }

  // Education evidence
  if ((candidate.education ?? []).length > 0) {
    const edu = candidate.education[0];
    evidence.push({
      claim: `Education: ${candidateEducationLabel}`,
      category: 'education',
      status: 'confirmed',
      source: 'Education section',
      excerpt: [edu.degree, edu.field ? `in ${edu.field}` : '', edu.institution ? `— ${edu.institution}` : '', edu.year ? `(${edu.year})` : '']
        .filter(Boolean)
        .join(' '),
    });
  } else if (job.educationRequirement) {
    evidence.push({
      claim: `Education: ${requiredEducationLabel || job.educationRequirement}`,
      category: 'education',
      status: 'missing',
      source: 'Evidence not found in resume',
      excerpt: 'No formal education record was found in the resume.',
    });
  }

  return evidence;
}
