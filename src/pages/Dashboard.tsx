import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  EyeOff,
  FileText,
  Plus,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { PageHeader } from '../components/PageHeader';
import { JobFormModal } from '../components/forms/JobFormModal';
import { Avatar, Badge, Button, Card, SampleTag } from '../components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/states';
import { activityMeta, formatDate, jobStatusMeta, stageMeta } from '../lib/utils';

export default function Dashboard() {
  const { data, loading, error, reload } = useApi(api.analytics.dashboard, []);
  const [createJobOpen, setCreateJobOpen] = useState(false);

  const stats = data?.stats;
  const candidates = data?.recentCandidates ?? [];
  const jobs = data?.activeJobs ?? [];
  const sampleTotal = (data?.sampleData.candidates ?? 0) + (data?.sampleData.jobs ?? 0) + (data?.sampleData.resumes ?? 0);
  const hasMatches = (data?.matchBands ?? []).some((b) => b.count > 0);
  const hasFunnel = (data?.applicationFunnel ?? []).some((f) => f.count > 0);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Workspace"
        title="Hiring Dashboard"
        description="Real-time overview of open jobs, applications, screening queue, and recruitment velocity."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/recruiter/screening">
              <Button variant="secondary" icon={EyeOff}>Blind Screening</Button>
            </Link>
            <Button icon={Plus} onClick={() => setCreateJobOpen(true)}>+ Create New Job</Button>
          </div>
        }
      />

      {sampleTotal > 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-[#F2D57A] bg-butter-100/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <SampleTag className="mt-0.5 shrink-0" />
            <p className="text-xs leading-5 text-plum-900">
              Labelled demo records are present for walkthroughs. Real recruiter and candidate records remain separate.
            </p>
          </div>
          <Link to="/recruiter/settings" className="shrink-0 text-xs font-semibold text-accent hover:underline">
            Manage demo data
          </Link>
        </div>
      )}

      {/* KPI Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Recruiter metrics">
        {[
          { label: 'Active Jobs', value: stats?.activeJobs ?? 0, sub: 'Open for applications', icon: BriefcaseBusiness, tone: 'bg-lavender-100 text-accent', to: '/recruiter/jobs' },
          { label: 'Total Applications', value: stats?.totalApplications ?? 0, sub: 'Submitted across roles', icon: ClipboardList, tone: 'bg-babyblue-100 text-babyblue-700', to: '/recruiter/pipeline' },
          { label: 'Awaiting Review', value: stats?.awaitingReview ?? 0, sub: `${stats?.resumesProcessed ?? 0} resumes parsed`, icon: FileText, tone: 'bg-butter-100 text-butter-700', to: '/recruiter/screening' },
          { label: 'Shortlisted', value: stats?.shortlistedCount ?? 0, sub: 'Ready for next step', icon: CheckCircle2, tone: 'bg-mint-100 text-mint-700', to: '/recruiter/pipeline' },
          { label: 'Interviews Active', value: stats?.interviewsInProgress ?? 0, sub: 'In interview or offer', icon: UsersRound, tone: 'bg-peach-100 text-peach-700', to: '/recruiter/candidates' },
        ].map((item) => (
          <Link key={item.label} to={item.to} className="card-surface card-surface-hover block p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-plum-700">{item.label}</p>
              <span className={`rounded-xl p-2 ${item.tone}`}>
                <item.icon className="h-4 w-4" />
              </span>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-14" />
            ) : (
              <p className="mt-3 font-display text-2xl font-bold text-plum-950">{item.value}</p>
            )}
            <p className="mt-1 text-[11px] text-plum-600">{item.sub}</p>
          </Link>
        ))}
      </section>

      {/* Charts Grid */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-plum-950">Hiring Pipeline & Funnel</h2>
              <p className="text-xs text-plum-600">Current distribution across candidate stages</p>
            </div>
            <Link to="/recruiter/pipeline" className="text-xs font-semibold text-accent hover:underline">Open pipeline</Link>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (stats?.totalCandidates ?? 0) === 0 && !hasFunnel ? (
            <EmptyState
              title="No pipeline activity yet"
              description="Create a job and screen or receive applications to populate your funnel."
              action={<Button size="sm" onClick={() => setCreateJobOpen(true)}>+ Create New Job</Button>}
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(hasFunnel ? data?.applicationFunnel : data?.pipeline)?.map((item) => ({ label: item.label, count: item.count })) ?? []}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Candidates" fill="#7D5CE6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-plum-950">Candidate Match Distribution</h2>
              <p className="text-xs text-plum-600">Deterministic match score bands across latest screenings</p>
            </div>
            <Badge variant="info">
              {stats?.averageMatchScore != null ? `Avg ${Math.round(stats.averageMatchScore)}%` : 'No matches'}
            </Badge>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : !hasMatches ? (
            <EmptyState
              title="No match scores calculated yet"
              description="Upload resumes or run deterministic matching on any job."
              action={<Link to="/recruiter/screening"><Button size="sm">Go to screening</Button></Link>}
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.matchBands ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Matches" radius={[8, 8, 0, 0]}>
                    {(data?.matchBands ?? []).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Activity over time + Active Jobs */}
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-plum-950">Recruitment Activity (7 Days)</h2>
              <p className="text-xs text-plum-600">Resumes parsed, matches evaluated, and stage transitions</p>
            </div>
            <Link to="/recruiter/reports" className="text-xs font-semibold text-accent hover:underline">Full reports</Link>
          </div>
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.trend ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="resumes" name="Resumes" stroke="#7D5CE6" fill="#E9DFFF" strokeWidth={2} />
                  <Area type="monotone" dataKey="matches" name="Matches" stroke="#236B50" fill="#D8F3E8" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-lavender-100 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-plum-950">Active Jobs</h2>
              <p className="text-xs text-plum-600">Published roles receiving candidates</p>
            </div>
            <Link to="/recruiter/jobs" className="text-xs font-semibold text-accent hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : jobs.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-10"
              icon={BriefcaseBusiness}
              title="No active jobs"
              description="Create your first job opening to start matching candidates."
              action={<Button size="sm" onClick={() => setCreateJobOpen(true)}>+ Create New Job</Button>}
            />
          ) : (
            <div className="divide-y divide-lavender-100">
              {jobs.slice(0, 4).map((job) => (
                <Link key={job.id} to={`/recruiter/jobs/${job.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-lavender-50/70">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-plum-950">{job.title}</p>
                    <p className="truncate text-xs text-plum-600">{job.location || 'Remote'} · {job.candidateCount ?? 0} matched</p>
                  </div>
                  <Badge className={jobStatusMeta[job.status]?.className}>{jobStatusMeta[job.status]?.label}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Candidates + Activity Feed */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-lavender-100 px-5 py-4">
            <h2 className="font-display text-base font-bold text-plum-950">Recent Candidates</h2>
            <Link to="/recruiter/candidates" className="text-xs font-semibold text-accent hover:underline">View all</Link>
          </div>
          {candidates.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-10"
              icon={UsersRound}
              title="No candidates yet"
              description="Upload PDF/DOCX resumes in Screening to extract profiles automatically."
              action={<Link to="/recruiter/screening"><Button size="sm">Upload Resumes</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-lavender-100">
              {candidates.slice(0, 5).map((candidate) => (
                <Link key={candidate.id} to={`/recruiter/candidates/${candidate.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-lavender-50/70">
                  <Avatar name={candidate.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-plum-950">{candidate.name}</p>
                    <p className="truncate text-xs text-plum-600">{candidate.latestJobTitle ?? candidate.title ?? 'Ready to match'}</p>
                  </div>
                  <Badge className={stageMeta[candidate.stage]?.className}>{stageMeta[candidate.stage]?.label}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-lavender-100 px-5 py-4">
            <h2 className="font-display text-base font-bold text-plum-950">Recent Activity</h2>
            <Link to="/recruiter/screening" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Screening <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {(data?.recentActivity ?? []).length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-10"
              icon={Sparkles}
              title="No recent activity"
              description="Actions like job posts, uploads, and stage changes appear here."
            />
          ) : (
            <div className="divide-y divide-lavender-100">
              {(data?.recentActivity ?? []).slice(0, 5).map((item) => {
                const meta = activityMeta[item.type];
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-plum-900">{item.message}</p>
                      <p className="mt-0.5 text-[11px] text-plum-600">{formatDate(item.created_at)}</p>
                    </div>
                    {meta && <Badge className={`shrink-0 border ${meta.color}`}>{meta.label}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <JobFormModal open={createJobOpen} onClose={() => setCreateJobOpen(false)} onSaved={reload} />
    </div>
  );
}
