import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Columns3, Plus, ScanLine, Search, Sparkles, UsersRound } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { CandidateFormModal } from '../components/forms/CandidateFormModal';
import { Modal } from '../components/ui/Modal';
import { AIResultPanel } from '../components/AIResultPanel';
import { Avatar, Badge, Button, Card, inputClass, ProgressBar, SampleTag, ScoreBadge, Toggle } from '../components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/states';
import { formatDate, scoreColor, stageMeta } from '../lib/utils';
import type { AiSuggestion, BlindCandidateProfile, Candidate, IntegrityReport, Job, StoredMatch } from '../types';

const PAGE_SIZE = 25;

interface ComparisonEntry {
  blind: boolean;
  candidate?: Candidate;
  profile?: BlindCandidateProfile;
  match: StoredMatch;
  integrity: IntegrityReport;
}

export default function Candidates() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [experience, setExperience] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  // Up-to-3 candidate comparison state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareJobId, setCompareJobId] = useState('');
  const [compareBlind, setCompareBlind] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{ job: Job; blind: boolean; comparisons: ComparisonEntry[]; disclaimer: string } | null>(null);
  const [compareAi, setCompareAi] = useState<AiSuggestion | null>(null);

  const jobsApi = useApi(() => api.jobs.list({ sort: 'recent' }), []);
  const jobs = jobsApi.data?.jobs ?? [];

  useEffect(() => {
    if (!compareJobId && jobs.length > 0) {
      const firstActive = jobs.find((j) => j.status === 'active') ?? jobs[0];
      setCompareJobId(firstActive.id);
    }
  }, [jobs, compareJobId]);

  const { data, loading, error, reload } = useApi(
    () =>
      api.candidates.list({
        search: search.trim() || undefined,
        stage: stage || undefined,
        minExperience: experience ? Number(experience) : undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, stage, experience, sort, page],
  );

  useEffect(() => {
    if (searchParams.get('add') === '1') setAddOpen(true);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [search, stage, experience, sort]);

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search.trim() || stage || experience || sort !== 'recent');
  const sampleCount = data?.sampleCount ?? 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) {
        toast.warning('You can compare up to 3 candidates at a time.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const runCompare = async (blindOverride?: boolean) => {
    if (selectedIds.length < 2) return toast.warning('Select 2 or 3 candidates to compare.');
    if (!compareJobId) return toast.warning('Create or select a job to compare against.');
    const useBlind = blindOverride ?? compareBlind;
    setComparing(true);
    setCompareAi(null);
    try {
      const res = await api.screening.compare({ candidateIds: selectedIds, jobId: compareJobId, blind: useBlind });
      setCompareResult(res);
      setCompareOpen(true);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to compare candidates.');
    } finally {
      setComparing(false);
    }
  };

  const runCompareAi = async () => {
    if (!compareJobId || selectedIds.length < 2) return;
    try {
      const ai = await api.ai.compareCandidates(selectedIds, compareJobId, compareBlind);
      setCompareAi(ai);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to generate AI comparison.');
    }
  };

  const closeAdd = () => {
    setAddOpen(false);
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStage('');
    setExperience('');
    setSort('recent');
  };

  const summary = useMemo(() => {
    if (loading) return 'Loading candidates…';
    if (total === 0) return 'No candidates yet';
    return `${total} candidate${total === 1 ? '' : 's'}`;
  }, [loading, total]);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Portal"
        title="Candidates"
        description="Review candidates, run side-by-side comparisons (up to 3), and inspect Evidence Ledgers."
        actions={
          <>
            <Link to="/recruiter/screening"><Button variant="secondary" icon={ScanLine}>Screen resumes</Button></Link>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>Add candidate</Button>
          </>
        }
      />

      {sampleCount > 0 && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#F2D57A] bg-butter-100/55 px-4 py-2.5">
          <SampleTag />
          <p className="text-xs text-plum-900">Demo candidates are clearly tagged and kept separate from real records.</p>
        </div>
      )}

      {/* Comparison Action Bar */}
      {selectedIds.length > 0 && (
        <Card className="mb-4 border-lavender-300 bg-lavender-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="violet">{selectedIds.length} / 3 selected for comparison</Badge>
              <select
                className={`${inputClass} h-9 sm:w-60`}
                value={compareJobId}
                onChange={(e) => setCompareJobId(e.target.value)}
                aria-label="Job for comparison"
              >
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <Toggle checked={compareBlind} onChange={setCompareBlind} label="Blind comparison" />
                <span className="text-xs font-semibold text-plum-900">Blind compare</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
              <Button size="sm" icon={Columns3} loading={comparing} disabled={selectedIds.length < 2} onClick={() => runCompare()}>
                Compare ({selectedIds.length})
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-400" />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, skill, or location"
              aria-label="Search candidates"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <select className={`${inputClass} lg:w-[145px]`} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
              <option value="">All stages</option>
              <option value="new">New</option>
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="hired">Hired</option>
              <option value="rejected">Not Selected</option>
            </select>
            <select className={`${inputClass} lg:w-[145px]`} value={experience} onChange={(e) => setExperience(e.target.value)} aria-label="Filter by experience">
              <option value="">Any experience</option>
              <option value="2">2+ years</option>
              <option value="5">5+ years</option>
              <option value="8">8+ years</option>
            </select>
            <select className={`${inputClass} col-span-2 sm:col-span-1 lg:w-[145px]`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort candidates">
              <option value="recent">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="experience">Most experience</option>
              <option value="match">Best job match</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-plum-600">{summary}</p>
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-accent hover:underline">Clear filters</button>
          </div>
        )}
      </Card>

      {loading ? (
        <Card><TableSkeleton rows={5} /></Card>
      ) : candidates.length === 0 ? (
        <Card>
          <EmptyState
            className="border-0 bg-transparent"
            icon={UsersRound}
            title={hasFilters ? 'No candidates match your filters' : 'Add your first candidate'}
            description={hasFilters ? 'Try a different search or clear filters.' : 'Upload PDF/DOCX resumes in Screening or add a candidate manually.'}
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>Add candidate</Button>
                  <Link to="/recruiter/screening"><Button size="sm" variant="secondary" icon={ScanLine}>Screen resumes</Button></Link>
                </div>
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
                    <th className="w-10 px-4 py-3">Compare</th>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Latest Match</th>
                    <th className="px-4 py-3">Experience</th>
                    <th className="px-4 py-3">Top Skills</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lavender-100">
                  {candidates.map((candidate) => {
                    const checked = selectedIds.includes(candidate.id);
                    return (
                      <tr key={candidate.id} className={`transition hover:bg-lavender-50/45 ${checked ? 'bg-lavender-50/75' : ''}`}>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleSelect(candidate.id)}
                            aria-label={`Select ${candidate.name} for comparison`}
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                              checked ? 'border-accent bg-accent text-white' : 'border-lavender-300 bg-white text-transparent hover:border-accent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={candidate.name} size="sm" />
                            <div className="min-w-0">
                              <Link to={`/recruiter/candidates/${candidate.id}`} className="flex items-center gap-1.5 truncate text-sm font-bold text-plum-950 hover:text-accent">
                                {candidate.name}
                                {candidate.isSample && <SampleTag />}
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-plum-600">{candidate.email || candidate.location || 'No contact added'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[190px] px-4 py-3.5">
                          {candidate.latestJobTitle ? (
                            <>
                              <p className="truncate text-xs font-semibold text-plum-950">{candidate.latestJobTitle}</p>
                              <ScoreBadge score={candidate.latestJobScore} className="mt-1" />
                            </>
                          ) : <span className="text-xs text-plum-600">Not matched yet</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-plum-900">{candidate.yearsExperience || 0} yrs</td>
                        <td className="max-w-[220px] px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 3).map((skill) => (
                              <span key={skill} className="rounded-full border border-lavender-200 bg-lavender-50 px-2 py-0.5 text-[10px] font-medium text-plum-900">{skill}</span>
                            ))}
                            {candidate.skills.length > 3 && <span className="px-1 py-0.5 text-[10px] text-plum-600">+{candidate.skills.length - 3}</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <Badge className={stageMeta[candidate.stage]?.className}>{stageMeta[candidate.stage]?.label}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link to={`/recruiter/candidates/${candidate.id}`} className="text-xs font-semibold text-accent hover:underline">View details</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-3 md:hidden">
            {candidates.map((candidate) => (
              <Link key={candidate.id} to={`/recruiter/candidates/${candidate.id}`} className="card-surface card-surface-hover block p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={candidate.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-plum-950">{candidate.name}</p>
                    <p className="mt-0.5 truncate text-xs text-plum-600">{candidate.latestJobTitle ?? candidate.title ?? 'Ready to match'}</p>
                  </div>
                  <Badge className={stageMeta[candidate.stage]?.className}>{stageMeta[candidate.stage]?.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-plum-700">
                  <span>{candidate.yearsExperience || 0} yrs</span>
                  {candidate.latestJobScore != null && <span>{Math.round(candidate.latestJobScore)}% match</span>}
                  <span>Added {formatDate(candidate.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-plum-600">Page {page} of {pages}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((v) => Math.min(pages, v + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Side-by-side Candidate Comparison Modal */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title={`Candidate Comparison (${compareResult?.job.title ?? ''})`}
        description="Side-by-side comparison of deterministic qualifications, missing skills, and Resume Integrity Radar flags."
        size="2xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-plum-600">{compareResult?.disclaimer}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={Sparkles} onClick={runCompareAi}>AI Comparison Summary</Button>
              <Button size="sm" variant="secondary" onClick={() => setCompareOpen(false)}>Close</Button>
            </div>
          </div>
        }
      >
        {compareAi && <div className="mb-4"><AIResultPanel result={compareAi} onDismiss={() => setCompareAi(null)} /></div>}
        {compareResult && (
          <div className={`grid gap-4 ${compareResult.comparisons.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {compareResult.comparisons.map((entry, idx) => {
              const title = entry.blind ? entry.profile?.anonymousId ?? `Candidate ${idx + 1}` : entry.candidate?.name ?? `Candidate ${idx + 1}`;
              const role = entry.blind ? entry.profile?.title : entry.candidate?.title;
              const years = entry.blind ? entry.profile?.yearsExperience ?? 0 : entry.candidate?.yearsExperience ?? 0;
              const edu = entry.blind ? entry.profile?.education?.[0]?.degree : entry.candidate?.education?.[0]?.degree;
              const projectsCount = entry.blind ? entry.profile?.projects?.length ?? 0 : entry.candidate?.projects?.length ?? 0;
              return (
                <div key={idx} className="rounded-2xl border border-lavender-200 bg-ivory p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-bold text-plum-950">{title}</p>
                      <p className="text-xs text-plum-600">{role || 'Role not stated'}</p>
                    </div>
                    <ScoreBadge score={entry.match.overallScore} />
                  </div>
                  <ProgressBar value={entry.match.overallScore} color={scoreColor(entry.match.overallScore)} />
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-2.5 text-[11px]">
                    <div><span className="text-plum-600">Experience:</span> <strong className="text-plum-950">{years} yrs</strong></div>
                    <div><span className="text-plum-600">Education:</span> <strong className="text-plum-950">{edu || 'N/A'}</strong></div>
                    <div><span className="text-plum-600">Skills score:</span> <strong className="text-plum-950">{Math.round(entry.match.skillsScore)}%</strong></div>
                    <div><span className="text-plum-600">Projects:</span> <strong className="text-plum-950">{projectsCount}</strong></div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-mint-700">Matched ({entry.match.matchedSkills.length})</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.match.matchedSkills.slice(0, 6).map((s) => (
                        <span key={s} className="rounded-full border border-[#A8DFCA] bg-mint-100 px-2 py-0.5 text-[10px] text-mint-700">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-peach-700">Missing ({entry.match.missingRequiredSkills.length})</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.match.missingRequiredSkills.length ? entry.match.missingRequiredSkills.map((s) => (
                        <span key={s} className="rounded-full border border-[#F7BCAA] bg-peach-100 px-2 py-0.5 text-[10px] text-peach-700">{s}</span>
                      )) : <span className="text-[11px] text-mint-700">All required skills covered</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-lavender-100 bg-white p-2.5 text-[11px]">
                    <p className="font-semibold text-plum-950">Integrity Radar: {entry.integrity.status}</p>
                    <p className="text-plum-600">{entry.integrity.dateConflictCount} date conflicts · {entry.integrity.missingInfoCount} missing info</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <CandidateFormModal open={addOpen} onClose={closeAdd} onSaved={() => { closeAdd(); reload(); }} />
    </div>
  );
}
