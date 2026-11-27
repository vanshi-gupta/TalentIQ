import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, FileSearch, ShieldCheck } from 'lucide-react';
import type { Candidate, EvidenceItem, Job, StoredMatch } from '../types';
import { Badge, ProgressBar, ScoreRing } from './ui/primitives';
import { experienceRange, matchRecommendation, scoreColor } from '../lib/utils';

const factorHelp: Record<string, string> = {
  skills: 'Required (80%) and preferred (20%) skills detected in the candidate profile.',
  experience: 'Detected employment years compared against the job experience threshold.',
  education: 'Highest detected qualification compared against the role requirement.',
  keywords: 'Relevant terminology overlap between the job description and candidate evidence.',
};

function EvidenceStatusBadge({ status }: { status: EvidenceItem['status'] }) {
  if (status === 'confirmed') return <Badge variant="success">Confirmed in resume</Badge>;
  if (status === 'inferred') return <Badge variant="warning">Inferred from text</Badge>;
  return <Badge variant="danger">Not found</Badge>;
}

export function MatchBreakdown({
  match,
  candidate,
  job,
  blindLabel,
}: {
  match: StoredMatch;
  candidate?: Candidate;
  job?: Job;
  blindLabel?: string;
}) {
  const displayCandidate = candidate ?? match.candidate;
  const displayJob = job ?? match.job;
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'confirmed' | 'missing'>('all');

  const factors = match.explanation?.factors?.length
    ? match.explanation.factors
    : [
        { key: 'skills', label: 'Skills', score: match.skillsScore, weight: match.weights.skills, contribution: 0, detail: '' },
        { key: 'experience', label: 'Experience', score: match.experienceScore, weight: match.weights.experience, contribution: 0, detail: '' },
        { key: 'education', label: 'Education', score: match.educationScore, weight: match.weights.education, contribution: 0, detail: '' },
        { key: 'keywords', label: 'Keywords', score: match.keywordScore, weight: match.weights.keywords, contribution: 0, detail: '' },
      ];

  const evidence = match.evidence ?? [];
  const filteredEvidence = evidence.filter((item) => {
    if (evidenceFilter === 'confirmed') return item.status === 'confirmed' || item.status === 'inferred';
    if (evidenceFilter === 'missing') return item.status === 'missing';
    return true;
  });

  const years = displayCandidate?.yearsExperience ?? 0;

  return (
    <div className="space-y-5">
      {/* TalentIQ Match DNA Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-babyblue-100/50 p-5 sm:flex-row sm:items-center">
        <ScoreRing score={match.overallScore} size={84} stroke={6} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-bold text-plum-950">
              {blindLabel ?? displayCandidate?.name ?? 'Candidate'}
            </p>
            <Badge variant="info">TalentIQ Match DNA</Badge>
          </div>
          <p className="mt-0.5 text-xs font-medium text-plum-600">{displayJob?.title ?? 'Job opening'}</p>
          <p className="mt-2 text-sm font-semibold" style={{ color: scoreColor(match.overallScore) }}>
            {matchRecommendation(match.overallScore)}
          </p>
        </div>
      </div>

      {/* Matched vs Missing Qualifications */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#A8DFCA] bg-mint-100/45 p-4">
          <p className="text-xs font-semibold text-mint-700">Matched qualifications ({match.matchedSkills.length})</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {match.matchedSkills.length > 0 ? (
              match.matchedSkills.map((skill) => (
                <span key={skill} className="rounded-full border border-[#A8DFCA] bg-white px-2.5 py-0.5 text-[11px] font-medium text-mint-700">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-plum-600">No direct skill matches detected.</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[#F7BCAA] bg-peach-100/45 p-4">
          <p className="text-xs font-semibold text-peach-700">Missing qualifications ({match.missingSkills.length})</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {match.missingSkills.length > 0 ? (
              match.missingSkills.map((skill) => (
                <span key={skill} className="rounded-full border border-[#F7BCAA] bg-white px-2.5 py-0.5 text-[11px] font-medium text-peach-700">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-mint-700">All listed job skills are covered.</span>
            )}
          </div>
        </div>
      </div>

      {/* Dimension Breakdown */}
      <div className="rounded-2xl border border-lavender-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-plum-950">Scoring Breakdown & Weights</h3>
          <span className="text-[11px] text-plum-600">Deterministic rule-based scoring</span>
        </div>
        <div className="mt-3.5 space-y-3.5">
          {factors.map((factor) => (
            <div key={factor.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-plum-950">
                  {factor.label} <span className="font-normal text-plum-600">({factor.weight}% weight)</span>
                </span>
                <span className="font-bold tabular-nums" style={{ color: scoreColor(factor.score) }}>
                  {Math.round(factor.score)}%
                </span>
              </div>
              <ProgressBar value={factor.score} color={scoreColor(factor.score)} height="h-2" />
              <p className="mt-1 text-[11px] leading-4 text-plum-600">{factor.detail || factorHelp[factor.key]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot Summary */}
      {!blindLabel && (
        <div className="grid gap-3 rounded-2xl border border-lavender-100 bg-ivory p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium text-plum-600">Experience Fit</p>
            <p className="mt-1 text-sm font-semibold text-plum-950">{years} years detected</p>
            {displayJob && <p className="mt-0.5 text-[11px] text-plum-600">Role asks {experienceRange(displayJob.minExperience, displayJob.maxExperience)}</p>}
          </div>
          <div>
            <p className="text-[11px] font-medium text-plum-600">Education Fit</p>
            <p className="mt-1 text-sm font-semibold text-plum-950">{displayCandidate?.education[0]?.degree || 'Not detected'}</p>
            {displayJob && <p className="mt-0.5 text-[11px] text-plum-600">Role asks {displayJob.educationRequirement || 'no specific degree'}</p>}
          </div>
          <div>
            <p className="text-[11px] font-medium text-plum-600">Current Role</p>
            <p className="mt-1 text-sm font-semibold text-plum-950">{displayCandidate?.title || 'Not specified'}</p>
            <p className="mt-0.5 text-[11px] text-plum-600">{displayCandidate?.location || 'Location not listed'}</p>
          </div>
        </div>
      )}

      {/* Evidence Ledger */}
      {evidence.length > 0 && (
        <div className="rounded-2xl border border-lavender-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-accent" />
              <div>
                <h3 className="font-display text-sm font-bold text-plum-950">Evidence Ledger</h3>
                <p className="text-[11px] text-plum-600">Inspect exact resume sources supporting each qualification claim.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'confirmed', 'missing'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEvidenceFilter(tab)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                    evidenceFilter === tab
                      ? 'bg-accent text-white'
                      : 'border border-lavender-200 bg-lavender-50 text-plum-700 hover:bg-lavender-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {filteredEvidence.map((item, idx) => (
              <div key={`${item.claim}-${idx}`} className="rounded-xl border border-lavender-100 bg-ivory p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-plum-950">{item.claim}</span>
                  <EvidenceStatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-[11px] font-medium text-accent">{item.source}</p>
                <p className="mt-1 text-xs leading-5 text-plum-700">“{item.excerpt}”</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Gaps */}
      {(match.strengths.length > 0 || match.gaps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {match.strengths.length > 0 && (
            <div className="rounded-2xl border border-[#A8DFCA] bg-mint-100/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-mint-700" />
                <h3 className="text-xs font-bold text-mint-700">Additional Strengths</h3>
              </div>
              <ul className="space-y-1.5">
                {match.strengths.map((item, index) => (
                  <li key={index} className="text-xs leading-5 text-plum-900">• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {match.gaps.length > 0 && (
            <div className="rounded-2xl border border-[#F2D57A] bg-butter-100/55 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-butter-700" />
                <h3 className="text-xs font-bold text-butter-700">Gaps & Review Notes</h3>
              </div>
              <ul className="space-y-1.5">
                {match.gaps.map((item, index) => (
                  <li key={index} className="text-xs leading-5 text-plum-900">• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Methodology & Trust Notice */}
      <div className="rounded-2xl border border-lavender-100 bg-lavender-50/70 p-3.5 text-[11px] leading-5 text-plum-700">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="font-semibold text-plum-950">Methodology & Human Oversight</p>
            <p>{match.explanation.methodology}</p>
            {match.reviewFlags.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {match.reviewFlags.map((flag, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-butter-700" />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
