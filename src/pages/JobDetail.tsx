import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  EyeOff,
  GraduationCap,
  IndianRupee,
  MapPin,
  Pencil,
  RefreshCw,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react';
import type { AiSuggestion, StoredMatch } from '../types';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { JobFormModal } from '../components/forms/JobFormModal';
import { ConfirmDialog } from '../components/ui/Modal';
import { AIResultPanel } from '../components/AIResultPanel';
import { Avatar, Badge, Button, Card, SampleTag, ScoreRing } from '../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '../components/ui/states';
import { MatchDetailModal } from '../components/MatchDetailModal';
import { experienceRange, formatDate, formatSalaryRangeInr, jobStatusMeta, matchRecommendation, relativeTime } from '../lib/utils';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(() => api.matches.job(id as string), [id], { enabled: Boolean(id) });
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<StoredMatch | null>(null);
  const [search, setSearch] = useState('');
  const [aiNote, setAiNote] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setSearch(''); setAiNote(null); }, [id]);

  const job = data?.job;
  const matches = data?.matches ?? [];
  const filteredMatches = search.trim()
    ? matches.filter((match) =>
        [match.candidate?.name, match.candidate?.title, match.matchedSkills.join(' ')]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : matches;

  const runMatching = async () => {
    if (!job) return;
    setRunning(true);
    try {
      const result = await api.matches.runJob(job.id);
      setData(result);
      toast.success('Matches updated.', `${result.candidateCount} candidates scored deterministically.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update job matches.');
    } finally {
      setRunning(false);
    }
  };

  const analyzeJob = async () => {
    if (!job) return;
    setAiLoading(true);
    try {
      const res = await api.ai.analyzeJob(job.id);
      setAiNote(res);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to summarize job description.');
    } finally {
      setAiLoading(false);
    }
  };

  const removeJob = async () => {
    if (!job) return;
    setDeleting(true);
    try {
      await api.jobs.remove(job.id);
      toast.success(`${job.title} was deleted.`);
      navigate('/recruiter/jobs');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to delete this job.');
      setDeleting(false);
    }
  };

  if (loading && !data) return <LoadingState label="Loading job opening…" />;
  if (error || !job) return <ErrorState message={error ?? 'Job not found.'} onRetry={reload} />;

  return (
    <div>
      <Link to="/recruiter/jobs" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-plum-700 transition hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to jobs
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={jobStatusMeta[job.status]?.className}>{jobStatusMeta[job.status]?.label}</Badge>
              <Badge variant="outline">{job.workMode || 'On-site'} · {job.employmentType}</Badge>
              {job.isSample && <SampleTag />}
              <span className="text-[11px] text-plum-600">Posted {formatDate(job.createdAt)}</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-plum-950">{job.title}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-plum-700">
              <span className="flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5 text-accent" />{job.company || 'TalentIQ Partner'} · {job.department || 'General'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-accent" />{job.location || 'Flexible'}</span>
              <span className="flex items-center gap-1.5 font-semibold text-mint-700"><IndianRupee className="h-3.5 w-3.5" />{formatSalaryRangeInr(job.salaryMinInr, job.salaryMaxInr).replace(/^₹/, '')}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-accent" />{experienceRange(job.minExperience, job.maxExperience)}</span>
              <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-accent" />{job.educationRequirement || 'Any degree'}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link to={`/recruiter/screening?job=${job.id}`}><Button size="sm" icon={EyeOff}>Blind Screen</Button></Link>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        </div>
      </Card>

      {aiNote && <div className="mt-5"><AIResultPanel result={aiNote} onDismiss={() => setAiNote(null)} /></div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-plum-950">About the role</h2>
              <Button size="sm" variant="outline" icon={Sparkles} loading={aiLoading} onClick={analyzeJob}>
                JD Summary
              </Button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-plum-900">{job.description}</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-plum-950">Qualifications</h2>
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-plum-600">Required skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.requiredSkills.map((skill) => (
                  <span key={skill} className="rounded-full border border-lavender-200 bg-lavender-100 px-2.5 py-0.5 text-xs font-medium text-plum-950">{skill}</span>
                ))}
              </div>
            </div>
            {job.preferredSkills.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-plum-600">Preferred skills</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.preferredSkills.map((skill) => (
                    <span key={skill} className="rounded-full border border-[#A7CCF7] bg-babyblue-100 px-2.5 py-0.5 text-xs font-medium text-babyblue-700">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-bold text-plum-950">Deterministic Matching</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-plum-600">
              {data?.lastRunAt ? `Last refreshed ${relativeTime(data.lastRunAt)}.` : 'Run matching to evaluate all candidates with evidence.'}
            </p>
            <Button variant="secondary" size="sm" className="mt-3" icon={RefreshCw} loading={running} onClick={runMatching}>
              {matches.length ? 'Refresh matches' : 'Run deterministic match'}
            </Button>
          </Card>
        </div>

        <Card className="overflow-hidden lg:col-span-8">
          <div className="border-b border-lavender-100 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-plum-950">Matched Candidates & Evidence</h2>
                <p className="mt-0.5 text-xs text-plum-600">Click any score to open Match DNA and the Evidence Ledger.</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-plum-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter candidates…"
                  className="h-9 w-full rounded-xl border border-lavender-200 bg-ivory pl-8 pr-3 text-xs text-plum-950 outline-none placeholder:text-plum-400 focus:border-accent sm:w-52"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : filteredMatches.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-14"
              icon={ScanLine}
              title="No matched candidates yet"
              description="Upload resumes in Screening or click Run deterministic match."
              action={<Button size="sm" onClick={runMatching} loading={running}>Run matching</Button>}
            />
          ) : (
            <div className="divide-y divide-lavender-100">
              {filteredMatches.map((match) => (
                <div key={match.id} className="flex flex-col gap-4 p-4 transition hover:bg-lavender-50/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={match.candidate?.name ?? 'Candidate'} size="md" />
                    <div className="min-w-0">
                      <Link to={`/recruiter/candidates/${match.candidateId}`} className="text-sm font-bold text-plum-950 hover:text-accent">
                        {match.candidate?.name ?? 'Candidate'}
                      </Link>
                      <p className="text-xs text-plum-600">{match.candidate?.title ?? 'Role not specified'} · {match.candidate?.yearsExperience ?? 0} yrs</p>
                      <p className="mt-1 text-xs text-plum-700">{matchRecommendation(match.overallScore)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {match.matchedSkills.slice(0, 4).map((s) => (
                          <span key={s} className="rounded-full border border-[#A8DFCA] bg-mint-100 px-2 py-0.5 text-[10px] font-medium text-mint-700">{s}</span>
                        ))}
                        {match.missingRequiredSkills.slice(0, 2).map((s) => (
                          <span key={s} className="rounded-full border border-[#F7BCAA] bg-peach-100 px-2 py-0.5 text-[10px] font-medium text-peach-700">Missing: {s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ScoreRing score={match.overallScore} size={58} stroke={5} />
                    <Button size="sm" variant="secondary" onClick={() => setSelectedMatch(match)}>Inspect DNA</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <JobFormModal open={editOpen} onClose={() => setEditOpen(false)} job={job} onSaved={reload} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeJob}
        loading={deleting}
        title="Delete job opening?"
        description={`Are you sure you want to permanently remove "${job.title}" and its associated match records?`}
        confirmLabel="Delete job"
      />
      <MatchDetailModal open={Boolean(selectedMatch)} onClose={() => setSelectedMatch(null)} match={selectedMatch} job={job} />
    </div>
  );
}
