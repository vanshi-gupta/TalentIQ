import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, ChevronRight, IndianRupee, MapPin, PauseCircle, PlayCircle, Plus, Search } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { JobFormModal } from '../components/forms/JobFormModal';
import { Badge, Button, Card, inputClass, SampleTag } from '../components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/states';
import { experienceRange, formatDate, formatSalaryRangeInr, jobStatusMeta } from '../lib/utils';
import type { Job, JobStatus } from '../types';

type StatusFilter = '' | 'active' | 'draft' | 'paused' | 'closed';

export default function Jobs() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [addOpen, setAddOpen] = useState(false);

  const { data, loading, error, reload } = useApi(
    () => api.jobs.list({ search: search.trim() || undefined, status: status || undefined }),
    [search, status],
  );

  useEffect(() => {
    if (searchParams.get('add') === '1') setAddOpen(true);
  }, [searchParams]);

  const closeAdd = () => {
    setAddOpen(false);
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  };

  const quickStatus = async (job: Job, nextStatus: JobStatus) => {
    try {
      await api.jobs.updateStatus(job.id, nextStatus);
      toast.success(`${job.title} is now ${nextStatus}.`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update job status.');
    }
  };

  const jobs = data?.jobs ?? [];
  const counts = data?.counts;
  const sampleCount = jobs.filter((job) => job.isSample).length;
  const statusFilters: { value: StatusFilter; label: string; count?: number }[] = [
    { value: '', label: 'All', count: (counts?.active ?? 0) + (counts?.draft ?? 0) + (counts?.paused ?? 0) + (counts?.closed ?? 0) },
    { value: 'active', label: 'Active', count: counts?.active },
    { value: 'draft', label: 'Draft', count: counts?.draft },
    { value: 'paused', label: 'Paused', count: counts?.paused },
    { value: 'closed', label: 'Closed', count: counts?.closed },
  ];

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Portal"
        title="Job Openings"
        description="Publish roles with INR salary ranges, manage status, and screen matched candidates."
        actions={<Button icon={Plus} onClick={() => setAddOpen(true)}>+ Create New Job</Button>}
      />

      {sampleCount > 0 && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#F2D57A] bg-butter-100/55 px-4 py-2.5">
          <SampleTag />
          <p className="text-xs text-plum-900">Demo job openings are included for exploration.</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-400" />
          <input
            className={`${inputClass} pl-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs by title, skill, or location"
            aria-label="Search jobs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${
                status === item.value
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-lavender-200 bg-white text-plum-700 hover:bg-lavender-50'
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={`text-[10px] ${status === item.value ? 'text-white/90' : 'text-plum-600'}`}>{item.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card><TableSkeleton rows={4} /></Card>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            className="border-0 bg-transparent"
            icon={BriefcaseBusiness}
            title={search || status ? 'No jobs match this view' : 'Create your first job opening'}
            description={search || status ? 'Try a different search or status filter.' : 'Define skills, INR compensation, and experience requirements to begin matching.'}
            action={
              search || status ? (
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>
              ) : (
                <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>+ Create New Job</Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-lavender-100 bg-ivory text-[11px] font-bold uppercase tracking-wide text-plum-600">
                    <th className="px-5 py-3">Job opening</th>
                    <th className="px-4 py-3">Location & Mode</th>
                    <th className="px-4 py-3">Package (INR)</th>
                    <th className="px-4 py-3">Experience</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lavender-100">
                  {jobs.map((job) => (
                    <tr key={job.id} className="transition hover:bg-lavender-50/50">
                      <td className="px-5 py-4">
                        <Link to={`/recruiter/jobs/${job.id}`} className="flex items-center gap-2 text-sm font-bold text-plum-950 hover:text-accent">
                          {job.title}
                          {job.isSample && <SampleTag />}
                        </Link>
                        <p className="mt-0.5 text-xs text-plum-600">
                          {job.company || 'TalentIQ Partner'} · {job.candidateCount ?? 0} matched · {formatDate(job.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs text-plum-900">
                        <span className="inline-flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 text-accent" />{job.location || 'India'}</span>
                        <p className="mt-0.5 text-[11px] text-plum-600">{job.workMode || 'On-site'} · {job.employmentType}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-mint-700">
                        <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" />{formatSalaryRangeInr(job.salaryMinInr, job.salaryMaxInr).replace(/^₹/, '')}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-plum-900">
                        {experienceRange(job.minExperience, job.maxExperience, true)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={jobStatusMeta[job.status]?.className}>{jobStatusMeta[job.status]?.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {job.status === 'active' ? (
                            <button type="button" onClick={() => quickStatus(job, 'paused')} className="rounded-lg border border-lavender-200 bg-white px-2 py-1 text-[11px] font-medium text-plum-700 hover:bg-peach-100 hover:text-peach-700" title="Pause job">
                              <PauseCircle className="inline h-3.5 w-3.5 mr-1" />Pause
                            </button>
                          ) : job.status !== 'closed' ? (
                            <button type="button" onClick={() => quickStatus(job, 'active')} className="rounded-lg border border-[#A8DFCA] bg-mint-100 px-2 py-1 text-[11px] font-medium text-mint-700 hover:bg-mint-200" title="Publish job">
                              <PlayCircle className="inline h-3.5 w-3.5 mr-1" />Publish
                            </button>
                          ) : null}
                          <Link to={`/recruiter/jobs/${job.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                            Open <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-3 md:hidden">
            {jobs.map((job) => (
              <Link key={job.id} to={`/recruiter/jobs/${job.id}`} className="card-surface card-surface-hover block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-plum-950">{job.title}</p>
                    <p className="mt-0.5 text-xs text-plum-600">{[job.location, job.workMode].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge className={jobStatusMeta[job.status]?.className}>{jobStatusMeta[job.status]?.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-plum-700">
                  <span>{formatSalaryRangeInr(job.salaryMinInr, job.salaryMaxInr)}</span>
                  <span>{experienceRange(job.minExperience, job.maxExperience, true)}</span>
                  <span>{job.candidateCount ?? 0} matched</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <JobFormModal open={addOpen} onClose={closeAdd} onSaved={() => { closeAdd(); reload(); }} />
    </div>
  );
}
