import { Link } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, Download, RefreshCw, UsersRound } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Badge, Button, Card, SampleTag } from '../components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/states';
import { downloadCsv, formatDate, jobStatusMeta } from '../lib/utils';

const stageColors: Record<string, string> = {
  new: '#2C598F',
  screening: '#7D5CE6',
  interview: '#236B50',
  offer: '#B87B14',
  hired: '#236B50',
  rejected: '#B94D48',
};

export default function Reports() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(api.analytics.all, []);

  const summary = data?.summary;
  const pipeline = data?.pipeline;
  const stages = data?.stages ?? [];
  const skills = data?.skills ?? [];
  const jobs = data?.jobs ?? [];
  const totalEvaluated = stages.reduce((sum, stage) => sum + stage.count, 0);
  const isEmpty = !loading && (summary?.totalCandidates ?? 0) === 0 && (summary?.totalJobs ?? 0) === 0;

  const exportReport = () => {
    if (!data) return;
    const rows: (string | number | null | undefined)[][] = [
      ['TalentIQ Recruitment Analytics Report'],
      ['Generated', formatDate(new Date().toISOString())],
      [],
      ['Summary', 'Value'],
      ['Total Candidates', data.summary.totalCandidates],
      ['Active Jobs', data.summary.activeJobs],
      ['Total Applications', data.summary.totalApplications ?? 0],
      ['Resumes Processed', data.summary.resumesProcessed],
      ['Average Match Score', data.summary.averageMatchScore === null ? 'No matches yet' : `${Math.round(data.summary.averageMatchScore)}%`],
      [],
      ['Stage', 'Candidates'],
      ...data.stages.map((stage) => [stage.label, stage.count]),
      [],
      ['Skill', 'Candidates'],
      ...data.skills.map((skill) => [skill.skill, skill.count]),
      [],
      ['Job', 'Status', 'Matched Candidates', 'Applicants', 'Average Match'],
      ...data.jobs.map((job) => [
        job.title,
        jobStatusMeta[job.status]?.label ?? job.status,
        job.candidateCount ?? 0,
        job.applicantCount ?? 0,
        job.averageMatchScore === null || job.averageMatchScore === undefined ? '' : `${Math.round(job.averageMatchScore)}%`,
      ]),
    ];
    downloadCsv(`talentiq-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Report exported as CSV.');
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Portal"
        title="Reports & Analytics"
        description="Real database insights into hiring funnel conversion, skill availability, and role-level performance."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} disabled={loading}>Refresh</Button>
            <Button icon={Download} onClick={exportReport} disabled={!data || isEmpty}>Export CSV</Button>
          </>
        }
      />

      {!loading && (summary?.sampleCandidates ?? 0) > 0 && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#F2D57A] bg-butter-100/55 px-4 py-2.5">
          <SampleTag />
          <p className="text-xs text-plum-900">Demo records are included in these counts. You can remove demo data in Settings.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-5">
          <Card className="p-5"><Skeleton className="h-16 w-full" /></Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5"><Skeleton className="h-[260px] w-full" /></Card>
            <Card className="p-5"><Skeleton className="h-[260px] w-full" /></Card>
          </div>
        </div>
      ) : isEmpty ? (
        <Card>
          <EmptyState
            className="border-0 bg-transparent py-16"
            icon={BarChart3}
            title="Insufficient data for analytics"
            description="Create a job opening and screen resumes or receive candidate applications to generate live reports."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/recruiter/jobs?add=1"><Button size="sm">+ Create New Job</Button></Link>
                <Link to="/recruiter/screening"><Button size="sm" variant="secondary">Upload Resumes</Button></Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Candidates', value: summary?.totalCandidates ?? 0, note: `${summary?.totalApplications ?? 0} job applications` },
                { label: 'Resumes Screened', value: summary?.resumesProcessed ?? 0, note: `${pipeline?.resumeSuccessRate ?? 100}% parse success` },
                { label: 'Average Match Score', value: summary?.averageMatchScore == null ? '—' : `${Math.round(summary.averageMatchScore)}%`, note: 'Deterministic average' },
                { label: 'Interview or Beyond', value: pipeline?.interviewsOrBeyond ?? 0, note: `of ${pipeline?.total ?? 0} candidates` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-lavender-100 bg-ivory p-3.5">
                  <p className="text-[11px] font-semibold text-plum-600">{item.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-plum-950">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-plum-600">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-plum-950">Hiring Funnel</h2>
                  <p className="mt-0.5 text-xs text-plum-600">Candidates distributed across stages</p>
                </div>
                <Badge variant="violet">{totalEvaluated} total</Badge>
              </div>
              {totalEvaluated === 0 ? (
                <div className="flex h-[240px] flex-col items-center justify-center text-center">
                  <UsersRound className="h-5 w-5 text-plum-400" />
                  <p className="mt-2 text-xs text-plum-600">Add candidates to see funnel progress.</p>
                </div>
              ) : (
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stages} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={86} />
                      <Tooltip />
                      <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]} barSize={20}>
                        {stages.map((s) => <Cell key={s.stage} fill={stageColors[s.stage] ?? '#7D5CE6'} />)}
                        <LabelList dataKey="count" position="right" fill="#34264A" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-plum-950">Skills Availability</h2>
                  <p className="mt-0.5 text-xs text-plum-600">Most frequent verified skills across applicants</p>
                </div>
                <Badge variant="info">{skills.length ? `Top ${Math.min(8, skills.length)}` : 'No skills'}</Badge>
              </div>
              {skills.length === 0 ? (
                <div className="flex h-[240px] flex-col items-center justify-center text-center">
                  <BarChart3 className="h-5 w-5 text-plum-400" />
                  <p className="mt-2 text-xs text-plum-600">Parse resumes to surface applicant skill trends.</p>
                </div>
              ) : (
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={skills.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="skill" axisLine={false} tickLine={false} width={96} />
                      <Tooltip />
                      <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]} barSize={16}>
                        {skills.slice(0, 8).map((skill, index) => (
                          <Cell key={skill.skill} fill={index < 3 ? '#7D5CE6' : '#CDBBFF'} />
                        ))}
                        <LabelList dataKey="count" position="right" fill="#34264A" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-lavender-100 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-plum-950">Job-wise Distribution</h2>
                <p className="mt-0.5 text-xs text-plum-600">Matched candidates, applications, and average deterministic score</p>
              </div>
              <Link to="/recruiter/jobs" className="text-xs font-semibold text-accent hover:underline">Manage jobs</Link>
            </div>
            {jobs.length === 0 ? (
              <EmptyState className="border-0 bg-transparent py-10" icon={BriefcaseBusiness} title="No jobs created yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-lavender-100 bg-ivory text-[11px] font-bold uppercase tracking-wide text-plum-600">
                      <th className="px-5 py-3">Job</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applicants</th>
                      <th className="px-4 py-3">Matched</th>
                      <th className="px-4 py-3">Avg Match</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lavender-100">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-lavender-50/40">
                        <td className="px-5 py-3">
                          <Link to={`/recruiter/jobs/${job.id}`} className="text-sm font-bold text-plum-950 hover:text-accent">{job.title}</Link>
                          <p className="text-[11px] text-plum-600">{job.location || 'India'}</p>
                        </td>
                        <td className="px-4 py-3"><Badge className={jobStatusMeta[job.status]?.className}>{jobStatusMeta[job.status]?.label}</Badge></td>
                        <td className="px-4 py-3 text-sm font-medium text-plum-900">{job.applicantCount ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-medium text-plum-900">{job.candidateCount ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-plum-950">
                          {job.averageMatchScore == null ? '—' : `${Math.round(job.averageMatchScore)}%`}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link to={`/recruiter/jobs/${job.id}`} className="text-xs font-semibold text-accent hover:underline">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
