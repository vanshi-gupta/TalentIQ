import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookmarkCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  FileText,
  GraduationCap,
  MessageSquareText,
  Radar,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, ProgressBar, ScoreBadge } from '../../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDate, formatSalaryRangeInr } from '../../lib/utils';

export default function CandidateDashboard() {
  const { data, loading, error, reload } = useApi(api.candidate.dashboard, []);

  if (loading && !data) return <LoadingState label="Loading your candidate dashboard…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unable to load candidate dashboard.'} onRetry={reload} />;

  const integrityVariant =
    data.integrityStatus === 'Information consistent'
      ? 'success'
      : data.integrityStatus === 'Needs attention'
        ? 'warning'
        : 'danger';

  const roadmapPct = data.roadmapProgress.total
    ? Math.round((data.roadmapProgress.completed / data.roadmapProgress.total) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Candidate Growth Portal"
        title={`Welcome, ${data.candidate.name}`}
        description="Track your profile readiness, discover matched and adjacent roles, and build skills that unlock new opportunities."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/candidate/resume"><Button variant="secondary" icon={FileText}>My Resume & Radar</Button></Link>
            <Link to="/candidate/jobs"><Button icon={Compass}>Explore Jobs</Button></Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-plum-700">Profile Completion</p>
            <CheckCircle2 className="h-4 w-4 text-mint-700" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-plum-950">{data.profileCompletion}%</p>
          <ProgressBar value={data.profileCompletion} color="#236B50" className="mt-3" />
          <Link to="/candidate/resume" className="mt-2 inline-block text-[11px] font-semibold text-accent hover:underline">
            {data.profileCompletion < 100 ? 'Complete missing details' : 'Profile looking strong'}
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-plum-700">Resume & Integrity</p>
            <Radar className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <Badge variant={integrityVariant} dot>{data.integrityStatus}</Badge>
          </div>
          <p className="mt-2 text-xs text-plum-600">
            {data.hasResume && data.latestResume ? `Uploaded: ${data.latestResume.originalName}` : 'No PDF/DOCX uploaded yet'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-plum-700">Applications</p>
            <BriefcaseBusiness className="h-4 w-4 text-babyblue-700" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-plum-950">{data.applicationsCount}</p>
          <p className="mt-1 text-xs text-plum-600">{data.savedJobsCount} saved roles for later</p>
          <Link to="/candidate/applications" className="mt-2 inline-block text-[11px] font-semibold text-accent hover:underline">
            Track status
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-plum-700">Career Roadmap</p>
            <GraduationCap className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-plum-950">
            {data.roadmapProgress.completed}/{data.roadmapProgress.total}
          </p>
          <ProgressBar value={roadmapPct} className="mt-2.5" />
          <Link to="/candidate/growth" className="mt-2 inline-block text-[11px] font-semibold text-accent hover:underline">
            {data.roadmapProgress.targetRole}
          </Link>
        </Card>
      </section>

      {/* Recommended Jobs & Application Progress */}
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-lavender-100 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-plum-950">Recommended Opportunities</h2>
              <p className="text-xs text-plum-600">Genuine active jobs matched to your skills & transferable experience</p>
            </div>
            <Link to="/candidate/jobs" className="text-xs font-semibold text-accent hover:underline">Browse all</Link>
          </div>
          {data.recommendations.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-10"
              icon={Sparkles}
              title="Add skills or upload your resume"
              description="We will match you to open roles and suggest transferable opportunities."
              action={<Link to="/candidate/resume"><Button size="sm">Upload Resume</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-lavender-100">
              {data.recommendations.map((rec) => (
                <div key={rec.job.id} className="p-4 transition hover:bg-lavender-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-plum-950">{rec.job.title}</p>
                      <p className="text-xs text-plum-600">
                        {rec.job.company} · {rec.job.location || 'India'} · {formatSalaryRangeInr(rec.job.salaryMinInr, rec.job.salaryMaxInr)}
                      </p>
                    </div>
                    <ScoreBadge score={rec.matchScore} />
                  </div>
                  <p className="mt-2 text-xs text-plum-900">{rec.whyRecommended}</p>
                  {rec.bridgeAction && (
                    <p className="mt-2 rounded-xl border border-lavender-100 bg-ivory px-3 py-2 text-[11px] text-plum-700">
                      <strong className="text-accent">Skill Bridge ({rec.bridgeAction.missingSkill}):</strong> {rec.bridgeAction.projectIdea}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5 lg:col-span-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-lavender-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-plum-950">Application Progress</h2>
              <Link to="/candidate/applications" className="text-xs font-semibold text-accent hover:underline">View all</Link>
            </div>
            {data.applicationsSummary.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-8"
                icon={BookmarkCheck}
                title="No applications yet"
                description="Apply to roles that match your goals."
                action={<Link to="/candidate/jobs"><Button size="sm">Find Jobs</Button></Link>}
              />
            ) : (
              <div className="divide-y divide-lavender-100">
                {data.applicationsSummary.slice(0, 4).map((app) => (
                  <div key={app.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-xs font-bold text-plum-950">Application #{app.id.slice(0, 6)}</p>
                      <p className="text-[11px] text-plum-600">Updated {formatDate(app.updatedAt)}</p>
                    </div>
                    <Badge variant={app.stage === 'selected' || app.stage === 'shortlisted' ? 'success' : app.stage === 'not_selected' ? 'danger' : 'info'}>
                      {app.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-gradient-to-br from-lavender-50 to-babyblue-100/50 p-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-accent" />
              <h3 className="font-display text-sm font-bold text-plum-950">Interview Readiness</h3>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-plum-700">
              Practice role-specific technical and STAR behavioral questions tailored to active jobs.
            </p>
            <Link to="/candidate/interview-prep" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
              Open Interview Prep <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
