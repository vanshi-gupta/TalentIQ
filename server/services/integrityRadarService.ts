import crypto from 'node:crypto';
import type { Candidate, IntegrityFinding, IntegrityReport, IntegrityStatus } from '../types.js';
import { canonicalSkill } from './skills.js';

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function parseFlexibleDate(raw: string | undefined, isEnd: boolean): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  if (cleaned === 'present' || cleaned === 'current' || cleaned === 'now' || cleaned === 'till date') {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const month = Math.min(11, Math.max(0, Number(dmy[2]) - 1));
    return Number(dmy[3]) * 12 + month;
  }
  const my = cleaned.match(/^(\d{1,2})[/-](\d{4})$/);
  if (my) {
    const month = Math.min(11, Math.max(0, Number(my[1]) - 1));
    return Number(my[2]) * 12 + month;
  }
  const monthYear = cleaned.match(/([a-z]{3,9})\s*,?\s*(\d{4})/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]];
    if (month !== undefined) return Number(monthYear[2]) * 12 + month;
  }
  const yearOnly = cleaned.match(/\b((?:19|20)\d{2})\b/);
  if (yearOnly) {
    return Number(yearOnly[1]) * 12 + (isEnd ? 11 : 0);
  }
  return null;
}

function isPartTimeOrInternship(title: string | undefined): boolean {
  if (!title) return false;
  return /\b(intern|internship|part[-\s]?time|freelance|volunteer|advisor|consultant)\b/i.test(title);
}

function findingId(seed: string): string {
  return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12);
}

export function analyzeResumeIntegrity(candidate: Pick<
  Candidate,
  'name' | 'skills' | 'education' | 'experience' | 'projects' | 'certifications' | 'yearsExperience' | 'resumeText'
>): IntegrityReport {
  const findings: IntegrityFinding[] = [];
  const experience = candidate.experience ?? [];
  const parsedRanges: {
    index: number;
    title: string;
    company: string;
    startRaw: string;
    endRaw: string;
    startMonth: number;
    endMonth: number;
  }[] = [];

  // A. Employment date checks
  for (let i = 0; i < experience.length; i += 1) {
    const entry = experience[i];
    const startMonth = parseFlexibleDate(entry.start, false);
    const endMonth = parseFlexibleDate(entry.end, true);

    if (!entry.start || !entry.end || startMonth === null || endMonth === null) {
      findings.push({
        id: findingId(`missing-date-${i}-${entry.title}`),
        category: 'missing_info',
        severity: 'attention',
        title: `Missing employment dates for "${entry.title}"`,
        detail: `No complete start and end dates were detected for ${entry.title}${entry.company ? ` at ${entry.company}` : ''}.`,
        evidenceExcerpt: `${entry.title}${entry.company ? ` — ${entry.company}` : ''} (${entry.start || 'start missing'} to ${entry.end || 'end missing'})`,
        suggestion: 'Add month and year (e.g., Jan 2022 – Mar 2024) so experience duration can be verified accurately.',
        confirmed: true,
      });
      continue;
    }

    if (endMonth < startMonth) {
      findings.push({
        id: findingId(`inverted-date-${i}-${entry.title}`),
        category: 'date_conflict',
        severity: 'review',
        title: `Inconsistent date order for "${entry.title}"`,
        detail: `The listed end date (${entry.end}) appears earlier than the start date (${entry.start}).`,
        evidenceExcerpt: `${entry.title}${entry.company ? ` at ${entry.company}` : ''}: ${entry.start} – ${entry.end}`,
        suggestion: 'Please verify and correct the start and end dates for this role.',
        confirmed: true,
      });
      continue;
    }

    parsedRanges.push({
      index: i,
      title: entry.title,
      company: entry.company || 'Employer not specified',
      startRaw: entry.start,
      endRaw: entry.end,
      startMonth,
      endMonth,
    });

    if (!entry.description || entry.description.trim().length < 15) {
      findings.push({
        id: findingId(`missing-desc-${i}-${entry.title}`),
        category: 'missing_info',
        severity: 'info',
        title: `Limited role description for "${entry.title}"`,
        detail: 'A job title was listed without responsibilities or project outcomes.',
        evidenceExcerpt: `${entry.title}${entry.company ? ` at ${entry.company}` : ''} (${entry.start} – ${entry.end})`,
        suggestion: 'Add 2–3 concise bullet points describing responsibilities and concrete outcomes.',
        confirmed: true,
      });
    }
  }

  // Overlap detection across employment ranges
  for (let i = 0; i < parsedRanges.length; i += 1) {
    for (let j = i + 1; j < parsedRanges.length; j += 1) {
      const a = parsedRanges[i];
      const b = parsedRanges[j];
      if (isPartTimeOrInternship(a.title) || isPartTimeOrInternship(b.title)) continue;
      // Overlap of more than 1 month (to tolerate single-month transition rounding)
      const overlapMonths = Math.min(a.endMonth, b.endMonth) - Math.max(a.startMonth, b.startMonth);
      if (overlapMonths >= 2) {
        findings.push({
          id: findingId(`overlap-${a.title}-${b.title}-${a.startRaw}-${b.startRaw}`),
          category: 'date_conflict',
          severity: 'review',
          title: 'Potential date overlap detected',
          detail: `Employment at ${a.company} (${a.startRaw} – ${a.endRaw}) overlaps by ~${overlapMonths} months with ${b.company} (${b.startRaw} – ${b.endRaw}).`,
          evidenceExcerpt: `${a.title} at ${a.company} (${a.startRaw} – ${a.endRaw}) | ${b.title} at ${b.company} (${b.startRaw} – ${b.endRaw})`,
          suggestion: 'Please confirm whether these positions overlapped (e.g., part-time/contract transition) or whether the dates need correction.',
          confirmed: true,
        });
      }
    }
  }

  // Duration vs stated yearsExperience check
  if (parsedRanges.length > 0 && candidate.yearsExperience > 0) {
    const sorted = [...parsedRanges].sort((x, y) => x.startMonth - y.startMonth);
    const merged: { start: number; end: number }[] = [];
    for (const r of sorted) {
      const prev = merged[merged.length - 1];
      if (prev && r.startMonth <= prev.end) {
        prev.end = Math.max(prev.end, r.endMonth);
      } else {
        merged.push({ start: r.startMonth, end: r.endMonth });
      }
    }
    const calculatedYears = Math.round((merged.reduce((sum, m) => sum + Math.max(0, m.end - m.start), 0) / 12) * 10) / 10;
    if (Math.abs(candidate.yearsExperience - calculatedYears) >= 2.0) {
      findings.push({
        id: findingId(`duration-mismatch-${candidate.yearsExperience}-${calculatedYears}`),
        category: 'date_conflict',
        severity: 'review',
        title: 'Listed total experience differs from employment timeline',
        detail: `Profile states ${candidate.yearsExperience} years of experience, whereas parsed employment dates sum to ~${calculatedYears} years.`,
        evidenceExcerpt: `Stated total: ${candidate.yearsExperience} years; parsed dates: ${sorted.map((s) => `${s.startRaw}–${s.endRaw}`).join(', ')}`,
        suggestion: 'Confirm whether earlier roles or internships were omitted from the dated work history.',
        confirmed: false,
      });
    }
  }

  // B. Education & Certifications missing info
  for (let i = 0; i < (candidate.education ?? []).length; i += 1) {
    const edu = candidate.education[i];
    if (!edu.year && !edu.institution) {
      findings.push({
        id: findingId(`edu-incomplete-${i}-${edu.degree}`),
        category: 'missing_info',
        severity: 'info',
        title: `Education entry lacks institution and completion year`,
        detail: `"${edu.degree}" does not list an institution name or completion year.`,
        evidenceExcerpt: `${edu.degree}${edu.field ? ` in ${edu.field}` : ''}`,
        suggestion: 'Include the university/college name and graduation year.',
        confirmed: true,
      });
    }
  }

  const certs = candidate.certifications ?? [];
  for (let i = 0; i < certs.length; i += 1) {
    const cert = certs[i];
    if (!cert.issuer) {
      findings.push({
        id: findingId(`cert-issuer-${i}-${cert.name}`),
        category: 'claim_verification',
        severity: 'attention',
        title: `Certification without issuing body: "${cert.name}"`,
        detail: 'The certification does not name an issuing organization or credential year.',
        evidenceExcerpt: `${cert.name}${cert.year ? ` (${cert.year})` : ''}`,
        suggestion: 'Add the issuing organization (e.g., AWS, NPTEL, Coursera) and year earned for human review.',
        confirmed: true,
      });
    }
  }

  // Skills listed without supporting examples in experience/projects
  const evidenceCorpus = [
    ...(candidate.experience ?? []).map((e) => `${e.title} ${e.description ?? ''}`),
    ...(candidate.projects ?? []).map((p) => `${p.name} ${p.description ?? ''} ${(p.technologies ?? []).join(' ')}`),
  ]
    .join(' ')
    .toLowerCase();

  if (evidenceCorpus.trim().length > 20) {
    const unsupportedSkills = (candidate.skills ?? []).filter((skill) => {
      const normalized = canonicalSkill(skill).toLowerCase();
      return normalized.length >= 2 && !evidenceCorpus.includes(normalized) && !evidenceCorpus.includes(skill.toLowerCase());
    });
    if (unsupportedSkills.length >= 3) {
      findings.push({
        id: findingId(`unsupported-skills-${unsupportedSkills.slice(0, 5).join(',')}`),
        category: 'missing_info',
        severity: 'info',
        title: 'Skills listed without supporting project or work examples',
        detail: `${unsupportedSkills.length} listed skills (${unsupportedSkills.slice(0, 4).join(', ')}) were not referenced in work history or project descriptions.`,
        evidenceExcerpt: `Skills list includes: ${unsupportedSkills.slice(0, 5).join(', ')}`,
        suggestion: 'Link key skills to specific projects or work outcomes so recruiters can see applied experience.',
        confirmed: false,
      });
    }
  }

  // C. Unsupported numerical achievement / ambiguous title claims
  const resumeText = candidate.resumeText ?? '';
  const numericClaims = resumeText.match(/[^.\n]*\b\d+(?:\.\d+)?%[^.\n]*/g) ?? [];
  for (const claim of numericClaims.slice(0, 2)) {
    const trimmed = claim.trim();
    if (trimmed.length > 15 && !/\b(by|from|to|reduced|improved|increased|saved|built|led|across|users|latency|revenue)\b/i.test(trimmed)) {
      findings.push({
        id: findingId(`numeric-claim-${trimmed.slice(0, 40)}`),
        category: 'claim_verification',
        severity: 'attention',
        title: 'Quantitative metric requires context verification',
        detail: 'A percentage or numerical impact claim appears without clear baseline or methodology context.',
        evidenceExcerpt: trimmed.slice(0, 200),
        suggestion: 'Clarify the baseline, timeframe, and your specific contribution behind this metric.',
        confirmed: false,
      });
    }
  }

  const ambiguousTitle = experience.find((e) => /^(role not specified|associate|member|consultant|specialist)$/i.test(e.title.trim()));
  if (ambiguousTitle) {
    findings.push({
      id: findingId(`ambiguous-title-${ambiguousTitle.title}`),
      category: 'claim_verification',
      severity: 'attention',
      title: `Ambiguous job title: "${ambiguousTitle.title}"`,
      detail: 'The listed role title is generic and may need clarification during screening.',
      evidenceExcerpt: `${ambiguousTitle.title}${ambiguousTitle.company ? ` at ${ambiguousTitle.company}` : ''}`,
      suggestion: 'Specify your functional role (e.g., Backend Engineer, Financial Analyst) for clearer matching.',
      confirmed: false,
    });
  }

  const dateConflictCount = findings.filter((f) => f.category === 'date_conflict').length;
  const missingInfoCount = findings.filter((f) => f.category === 'missing_info').length;
  const claimsVerificationCount = findings.filter((f) => f.category === 'claim_verification').length;

  let status: IntegrityStatus = 'Information consistent';
  if (dateConflictCount > 0 || claimsVerificationCount >= 2) {
    status = 'Manual verification recommended';
  } else if (missingInfoCount > 0 || claimsVerificationCount > 0) {
    status = 'Needs attention';
  }

  const penalty = dateConflictCount * 22 + claimsVerificationCount * 10 + missingInfoCount * 7;
  const overallIndicator = Math.max(25, Math.min(100, 100 - penalty));

  return {
    status,
    overallIndicator,
    dateConflictCount,
    missingInfoCount,
    claimsVerificationCount,
    findings,
    analyzedAt: new Date().toISOString(),
    disclaimer:
      'Resume Integrity Radar surfaces potential date conflicts, gaps, and claims for human review. It is an integrity-assistance tool, not an automated rejection or external background-check service.',
  };
}
