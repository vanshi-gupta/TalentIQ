import crypto from 'node:crypto';
import { getDb, logActivity, newId, nowIso, writeAuditLog } from '../database.js';
import type { BlindCandidateProfile, Candidate, IntegrityReport, StoredMatch, User } from '../types.js';
import { analyzeResumeIntegrity } from './integrityRadarService.js';

export function anonymousCandidateId(candidateId: string): string {
  const hash = crypto.createHash('sha256').update(`talentiq-blind:${candidateId}`).digest('hex').slice(0, 6).toUpperCase();
  return `CAND-${hash}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactTextForBlindReview(text: string | null | undefined, candidate: Pick<Candidate, 'name' | 'email' | 'phone' | 'location'>): string | null {
  if (!text) return null;
  let output = text;
  if (candidate.email) {
    output = output.replace(new RegExp(escapeRegex(candidate.email), 'gi'), '[Email Redacted]');
  }
  if (candidate.phone) {
    output = output.replace(new RegExp(escapeRegex(candidate.phone), 'gi'), '[Phone Redacted]');
  }
  if (candidate.location) {
    output = output.replace(new RegExp(escapeRegex(candidate.location), 'gi'), '[Location Redacted]');
  }
  for (const part of candidate.name.split(/\s+/).filter((p) => p.length >= 2)) {
    output = output.replace(new RegExp(`\\b${escapeRegex(part)}\\b`, 'gi'), '[Candidate]');
  }
  output = output
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[Email Redacted]')
    .replace(/(?:\+91[\s.-]?)?\b[6-9]\d{4}[\s.-]?\d{5}\b/g, '[Phone Redacted]')
    .replace(/https?:\/\/(?:www\.)?(?:linkedin\.com|github\.com|twitter\.com|x\.com)[^\s,)]*/gi, '[Profile Link Redacted]')
    .replace(/\b(he|she|him|her|his|hers|himself|herself)\b/gi, 'they')
    .replace(/\b(mr|mrs|ms|miss)\.?/gi, '');
  return output.trim();
}

export function getRevealRecord(
  candidateId: string,
  jobId?: string | null,
): { revealed: boolean; revealedAt: string | null; revealedBy: string | null } {
  const database = getDb();
  const row = (jobId
    ? database
        .prepare(
          `SELECT ir.created_at, u.full_name
           FROM identity_reveals ir
           LEFT JOIN users u ON u.id = ir.recruiter_user_id
           WHERE ir.candidate_id = ? AND (ir.job_id = ? OR ir.job_id IS NULL)
           ORDER BY ir.created_at DESC LIMIT 1`,
        )
        .get(candidateId, jobId)
    : database
        .prepare(
          `SELECT ir.created_at, u.full_name
           FROM identity_reveals ir
           LEFT JOIN users u ON u.id = ir.recruiter_user_id
           WHERE ir.candidate_id = ?
           ORDER BY ir.created_at DESC LIMIT 1`,
        )
        .get(candidateId)) as { created_at: string; full_name: string | null } | undefined;

  if (!row) return { revealed: false, revealedAt: null, revealedBy: null };
  return { revealed: true, revealedAt: row.created_at, revealedBy: row.full_name ?? 'Authorized Recruiter' };
}

export function buildBlindCandidateProfile(params: {
  candidate: Candidate;
  jobId?: string | null;
  match?: StoredMatch | null;
  applicationStage?: BlindCandidateProfile['applicationStage'];
  forceBlind?: boolean;
}): BlindCandidateProfile {
  const { candidate, jobId, match, applicationStage, forceBlind } = params;
  const reveal = forceBlind ? { revealed: false, revealedAt: null, revealedBy: null } : getRevealRecord(candidate.id, jobId);
  const anonId = anonymousCandidateId(candidate.id);
  const integrityReport: IntegrityReport = analyzeResumeIntegrity(candidate);

  const redactedMatch = match
    ? {
        ...match,
        candidate: undefined,
        explanation: {
          ...match.explanation,
          summary: redactTextForBlindReview(match.explanation.summary, candidate) ?? match.explanation.summary,
        },
        evidence: (match.evidence ?? []).map((ev) => ({
          ...ev,
          source: redactTextForBlindReview(ev.source, candidate) ?? ev.source,
          excerpt: redactTextForBlindReview(ev.excerpt, candidate) ?? ev.excerpt,
        })),
      }
    : null;

  return {
    anonymousId: anonId,
    candidateId: candidate.id,
    revealed: reveal.revealed,
    revealedAt: reveal.revealedAt,
    revealedBy: reveal.revealedBy,
    title: candidate.title,
    summary: redactTextForBlindReview(candidate.summary, candidate),
    skills: candidate.skills,
    yearsExperience: candidate.yearsExperience,
    education: (candidate.education ?? []).map((e) => ({
      degree: e.degree,
      field: e.field,
      year: e.year,
    })),
    experience: (candidate.experience ?? []).map((exp) => ({
      title: exp.title,
      start: exp.start,
      end: exp.end,
      description: redactTextForBlindReview(exp.description, candidate) ?? undefined,
    })),
    projects: (candidate.projects ?? []).map((p) => ({
      ...p,
      url: undefined,
      description: redactTextForBlindReview(p.description, candidate) ?? undefined,
    })),
    certifications: candidate.certifications ?? [],
    stage: candidate.stage,
    applicationStage: applicationStage ?? null,
    match: redactedMatch,
    integrityReport,
    redactionNotice:
      'Blind Review Active: personal identifiers (name, contact details, links, location, employer/institution names, and gendered pronouns) are stripped on the server to help reduce identity-related bias during initial screening.',
    ...(reveal.revealed
      ? {
          identity: {
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            location: candidate.location,
          },
        }
      : {}),
  };
}

export function revealCandidateIdentity(params: {
  candidate: Candidate;
  jobId?: string | null;
  recruiter: User;
  reason: string;
  ipAddress?: string | null;
}) {
  const id = newId();
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO identity_reveals (id, candidate_id, job_id, recruiter_user_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, params.candidate.id, params.jobId ?? null, params.recruiter.id, params.reason, ts);

  writeAuditLog({
    actorUserId: params.recruiter.id,
    actorRole: params.recruiter.role,
    action: 'identity_revealed',
    targetType: 'candidate',
    targetId: params.candidate.id,
    details: {
      anonymousId: anonymousCandidateId(params.candidate.id),
      jobId: params.jobId ?? null,
      reason: params.reason,
    },
    ipAddress: params.ipAddress ?? null,
  });

  logActivity('identity_revealed', `Identity revealed for ${anonymousCandidateId(params.candidate.id)} by ${params.recruiter.fullName}.`, {
    candidateId: params.candidate.id,
    jobId: params.jobId ?? null,
    meta: { reason: params.reason },
  });

  return {
    revealed: true,
    revealedAt: ts,
    revealedBy: params.recruiter.fullName,
    anonymousId: anonymousCandidateId(params.candidate.id),
    identity: {
      name: params.candidate.name,
      email: params.candidate.email,
      phone: params.candidate.phone,
      location: params.candidate.location,
    },
  };
}
