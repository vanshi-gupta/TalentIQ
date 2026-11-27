import { AlertTriangle, CheckCircle2, Info, Radar, ShieldAlert } from 'lucide-react';
import type { IntegrityReport } from '../types';
import { Badge, Card, ProgressBar } from './ui/primitives';

export function IntegrityRadarCard({
  report,
  perspective = 'recruiter',
}: {
  report: IntegrityReport;
  perspective?: 'recruiter' | 'candidate';
}) {
  const badgeVariant =
    report.status === 'Information consistent'
      ? 'success'
      : report.status === 'Needs attention'
        ? 'warning'
        : 'danger';

  const barColor =
    report.status === 'Information consistent'
      ? '#236B50'
      : report.status === 'Needs attention'
        ? '#B87B14'
        : '#B94D48';

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-lavender-200 bg-lavender-100 p-2">
            <Radar className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-plum-950">Resume Integrity Radar</h3>
            <p className="text-xs text-plum-600">
              {perspective === 'candidate'
                ? 'Constructive review of timeline dates, missing details, and evidence clarity.'
                : 'Review-assistance flags for manual verification — never an automatic rejection.'}
            </p>
          </div>
        </div>
        <Badge variant={badgeVariant} dot>{report.status}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-lavender-100 bg-ivory p-3">
          <p className="text-[11px] font-medium text-plum-600">Consistency score</p>
          <p className="mt-1 font-display text-lg font-bold text-plum-950">{report.overallIndicator}%</p>
          <ProgressBar value={report.overallIndicator} color={barColor} className="mt-2" height="h-1.5" />
        </div>
        <div className="rounded-xl border border-[#F7BCAA] bg-peach-100/40 p-3">
          <p className="text-[11px] font-medium text-peach-700">Date conflicts</p>
          <p className="mt-1 font-display text-lg font-bold text-plum-950">{report.dateConflictCount}</p>
        </div>
        <div className="rounded-xl border border-[#F2D57A] bg-butter-100/50 p-3">
          <p className="text-[11px] font-medium text-butter-700">Missing details</p>
          <p className="mt-1 font-display text-lg font-bold text-plum-950">{report.missingInfoCount}</p>
        </div>
        <div className="rounded-xl border border-[#A7CCF7] bg-babyblue-100/45 p-3">
          <p className="text-[11px] font-medium text-babyblue-700">Verify manually</p>
          <p className="mt-1 font-display text-lg font-bold text-plum-950">{report.claimsVerificationCount}</p>
        </div>
      </div>

      {report.findings.length === 0 ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#A8DFCA] bg-mint-100/50 px-4 py-3 text-xs font-medium text-mint-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          No employment date conflicts or missing structural details were detected.
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {report.findings.map((finding) => {
            const Icon =
              finding.severity === 'review' ? ShieldAlert : finding.severity === 'attention' ? AlertTriangle : Info;
            const tone =
              finding.severity === 'review'
                ? 'border-[#F7BCAA] bg-peach-100/35'
                : finding.severity === 'attention'
                  ? 'border-[#F2D57A] bg-butter-100/40'
                  : 'border-[#A7CCF7] bg-babyblue-100/35';
            return (
              <div key={finding.id} className={`rounded-xl border p-3.5 ${tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-plum-950" />
                    <p className="text-xs font-bold text-plum-950">{finding.title}</p>
                  </div>
                  <Badge variant={finding.confirmed ? 'warning' : 'outline'}>
                    {finding.confirmed ? 'Confirmed check' : 'Possible concern'}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-plum-900">{finding.detail}</p>
                <p className="mt-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] text-plum-700">
                  <span className="font-semibold">Evidence excerpt:</span> “{finding.evidenceExcerpt}”
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-accent">
                  Suggestion: {finding.suggestion}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-4 text-plum-600">{report.disclaimer}</p>
    </Card>
  );
}
