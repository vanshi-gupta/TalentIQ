import { Link } from 'react-router-dom';
import { BriefcaseBusiness, Compass } from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, ScoreBadge } from '../../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDate, formatSalaryRangeInr } from '../../lib/utils';

export default function MyApplications() {
  const { data, loading, error, reload } = useApi(api.candidate.applications, []);
  const applications = data?.applications ?? [];

  if (loading && !data) return <LoadingState label="Loading your applications…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Candidate Portal"
        title="My Applications"
        description="Track every submitted application transparently across Applied, Under Review, Shortlisted, Interview, and Final Outcome."
        actions={<Link to="/candidate/jobs"><Button icon={Compass}>Browse Open Jobs</Button></Link>}
      />

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            className="border-0 bg-transparent py-14"
            icon={BriefcaseBusiness}
            title="You haven't applied to any jobs yet"
            description="Explore jobs matched to your profile and apply in one click."
            action={<Link to="/candidate/jobs"><Button size="sm">Find Jobs</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-bold text-plum-950">{app.job?.title ?? 'Job Opening'}</h2>
                    <Badge
                      variant={
                        app.stage === 'selected' || app.stage === 'shortlisted'
                          ? 'success'
                          : app.stage === 'not_selected'
                            ? 'danger'
                            : app.stage === 'interview'
                              ? 'warning'
                              : 'info'
                      }
                      dot
                    >
                      {app.statusLabel ?? app.stage}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-plum-600">
                    {app.job?.company ?? 'TalentIQ Partner'} · {app.job?.location ?? 'India'} · {formatSalaryRangeInr(app.job?.salaryMinInr, app.job?.salaryMaxInr)}
                  </p>
                  <p className="mt-1 text-[11px] text-plum-600">
                    Applied on {formatDate(app.createdAt)} · Last updated {formatDate(app.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {app.match && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase text-plum-600">Match DNA</p>
                      <ScoreBadge score={app.match.overallScore} />
                    </div>
                  )}
                  {app.stage === 'not_selected' && (
                    <Link to="/candidate/jobs">
                      <Button size="sm" variant="outline">View Alternative Roles</Button>
                    </Link>
                  )}
                </div>
              </div>
              {app.match && app.match.missingSkills.length > 0 && (
                <div className="mt-3 rounded-xl border border-lavender-100 bg-ivory px-3.5 py-2.5 text-xs text-plum-800">
                  <strong className="text-accent">Skills to strengthen for this role:</strong> {app.match.missingSkills.join(', ')}{' '}
                  <Link to="/candidate/growth" className="ml-1 font-semibold text-accent hover:underline">Open Career Growth →</Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
