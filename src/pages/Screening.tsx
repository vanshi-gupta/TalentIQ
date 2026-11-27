import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  LockOpen,
  Radar,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { BlindCandidateProfile, ResumeRecord, StoredMatch, UploadResult } from '../types';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Badge, Button, Card, Field, inputClass, ProgressBar, SampleTag, ScoreBadge, textareaClass } from '../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '../components/ui/states';
import { MatchDetailModal } from '../components/MatchDetailModal';
import { formatDateTime, formatFileSize } from '../lib/utils';

type QueueStatus = 'queued' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  error?: string;
  result?: UploadResult;
}

const MAX_FILES = 10;

function queueId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Screening() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const requestedJob = searchParams.get('job');
  const inputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'blind' | 'upload'>('blind');
  const [selectedJobId, setSelectedJobId] = useState('');

  // Blind screening state
  const blindApi = useApi(() => api.screening.blindList(selectedJobId || undefined), [selectedJobId]);
  const [revealTarget, setRevealTarget] = useState<BlindCandidateProfile | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<{ match: StoredMatch; blindLabel?: string } | null>(null);

  // Upload & Library state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResumeRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteResume, setDeleteResume] = useState<ResumeRecord | null>(null);
  const [deletingResume, setDeletingResume] = useState(false);

  const jobsApi = useApi(() => api.jobs.list({ sort: 'recent' }), []);
  const settingsApi = useApi(api.settings.get, []);
  const resumesApi = useApi(api.resumes.list, []);

  const jobs = jobsApi.data?.jobs ?? [];
  const activeJobs = jobs.filter((j) => j.status === 'active');
  const maxMb = settingsApi.data?.system.maxUploadMb ?? 10;
  const maxBytes = maxMb * 1024 * 1024;
  const allResumes = resumesApi.data?.resumes ?? [];

  useEffect(() => {
    if (requestedJob) {
      setSelectedJobId(requestedJob);
    } else if (!selectedJobId && activeJobs.length > 0) {
      setSelectedJobId(activeJobs[0].id);
    }
  }, [requestedJob, activeJobs, selectedJobId]);

  useEffect(() => {
    if (!previewId) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    api.resumes.get(previewId)
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [previewId]);

  const addFiles = (files: FileList | File[]) => {
    const next: QueueItem[] = [];
    const errors: string[] = [];
    const existingNames = new Set(queue.map((i) => i.file.name.toLowerCase()));
    for (const file of Array.from(files)) {
      if (queue.length + next.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} resumes per batch.`);
        break;
      }
      if (!/\.(pdf|docx)$/i.test(file.name)) {
        errors.push(`${file.name} is not a PDF or DOCX file.`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`${file.name} exceeds ${maxMb} MB.`);
        continue;
      }
      if (existingNames.has(file.name.toLowerCase())) continue;
      existingNames.add(file.name.toLowerCase());
      next.push({ id: queueId(), file, status: 'queued' });
    }
    if (next.length) setQueue((c) => [...c, ...next]);
    if (errors.length) toast.error(errors[0], 'File validation');
  };

  const handleUploadAll = async () => {
    const pending = queue.filter((q) => q.status === 'queued');
    if (pending.length === 0) return;
    setUploading(true);
    for (const item of pending) {
      setQueue((curr) => curr.map((q) => (q.id === item.id ? { ...q, status: 'processing' } : q)));
      try {
        const result = await api.resumes.upload(item.file, selectedJobId || undefined);
        setQueue((curr) => curr.map((q) => (q.id === item.id ? { ...q, status: 'done', result } : q)));
      } catch (caught) {
        const msg = caught instanceof ApiError ? caught.message : 'Upload failed.';
        setQueue((curr) => curr.map((q) => (q.id === item.id ? { ...q, status: 'error', error: msg } : q)));
      }
    }
    setUploading(false);
    resumesApi.reload();
    blindApi.reload();
    toast.success('Batch screening completed.');
  };

  const shortlistCandidate = async (profile: BlindCandidateProfile, stage: 'shortlisted' | 'screening') => {
    if (!selectedJobId) return toast.warning('Select a job first.');
    try {
      await api.screening.assignPipeline({
        candidateId: profile.candidateId,
        jobId: selectedJobId,
        stage,
        reason: stage === 'shortlisted' ? 'Shortlisted during Blind Screening' : 'Requested further qualification review',
      });
      toast.success(
        stage === 'shortlisted'
          ? `${profile.anonymousId} shortlisted for next step.`
          : `${profile.anonymousId} flagged for further review.`,
      );
      blindApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update screening decision.');
    }
  };

  const submitReveal = async () => {
    if (!revealTarget || revealReason.trim().length < 4) {
      return toast.warning('Provide a short audit reason (at least 4 characters).');
    }
    setRevealing(true);
    try {
      const res = await api.screening.revealIdentity({
        candidateId: revealTarget.candidateId,
        jobId: selectedJobId || undefined,
        reason: revealReason.trim(),
      });
      toast.success(`Identity revealed for ${res.anonymousId} (${res.identity.name}). Action logged.`);
      setRevealTarget(null);
      setRevealReason('');
      blindApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to reveal identity.');
    } finally {
      setRevealing(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!deleteResume) return;
    setDeletingResume(true);
    try {
      await api.resumes.remove(deleteResume.id);
      toast.success(`${deleteResume.originalName} removed.`);
      setDeleteResume(null);
      resumesApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to delete resume.');
    } finally {
      setDeletingResume(false);
    }
  };

  const completedCount = queue.filter((q) => q.status === 'done' || q.status === 'error').length;
  const progress = queue.length ? Math.round((completedCount / queue.length) * 100) : 0;
  const filteredResumes = allResumes.filter((r) =>
    !librarySearch.trim() ? true : `${r.originalName} ${r.candidateName ?? ''}`.toLowerCase().includes(librarySearch.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Bias-Conscious Screening"
        title="Screening & Resume Upload"
        description="Evaluate anonymized qualifications first with server-side redaction, or upload PDF/DOCX resumes in batches."
        actions={
          <div className="flex rounded-full border border-lavender-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab('blind')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === 'blind' ? 'bg-accent text-white' : 'text-plum-700 hover:text-plum-950'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" /> Blind Screening
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === 'upload' ? 'bg-accent text-white' : 'text-plum-700 hover:text-plum-950'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" /> Upload & Library
            </button>
          </div>
        }
      />

      {/* Job Selector Bar */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-plum-950">Target Job Opening</p>
            <p className="text-[11px] text-plum-600">Select a role to score candidates deterministically and inspect evidence.</p>
          </div>
          <select
            className={`${inputClass} sm:w-80`}
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            aria-label="Target job opening"
          >
            <option value="">All candidates (unfiltered)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.status})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {tab === 'blind' ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#A8DFCA] bg-mint-100/55 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-mint-700 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-bold text-plum-950">Blind Review Active</h2>
                  <Badge variant="success">Server-Side Redacted</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-plum-900">
                  Names, contact info, locations, employer/college names, and gendered pronouns are stripped by the backend to help reduce identity-related bias during initial screening. Identity reveal requires an audited reason.
                </p>
              </div>
            </div>
          </div>

          {blindApi.error ? (
            <ErrorState message={blindApi.error} onRetry={blindApi.reload} />
          ) : blindApi.loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-60" />
              <Skeleton className="h-60" />
            </div>
          ) : (blindApi.data?.candidates ?? []).length === 0 ? (
            <Card>
              <EmptyState
                className="border-0 bg-transparent py-14"
                icon={ScanLine}
                title="No candidates ready for screening"
                description="Switch to Upload & Library to parse PDF or DOCX resumes."
                action={<Button size="sm" onClick={() => setTab('upload')}>Upload Resumes</Button>}
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(blindApi.data?.candidates ?? []).map((profile) => (
                <Card key={profile.candidateId} className="flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-bold text-plum-950">
                            {profile.revealed && profile.identity ? profile.identity.name : profile.anonymousId}
                          </span>
                          {profile.revealed ? (
                            <Badge variant="warning">Identity Revealed</Badge>
                          ) : (
                            <Badge variant="violet">Anonymous</Badge>
                          )}
                          {profile.applicationStage && <Badge variant="info">{profile.applicationStage}</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-plum-700">
                          {profile.title || 'Role not stated'} · {profile.yearsExperience} yrs experience
                        </p>
                      </div>
                      {profile.match && <ScoreBadge score={profile.match.overallScore} />}
                    </div>

                    {profile.revealed && profile.identity && (
                      <div className="mt-3 rounded-xl border border-[#F2D57A] bg-butter-100/50 px-3 py-2 text-xs text-plum-950">
                        <p className="font-semibold">Revealed Contact: {profile.identity.email || 'No email'} · {profile.identity.phone || 'No phone'}</p>
                        <p className="text-[11px] text-plum-700">Revealed by {profile.revealedBy}</p>
                      </div>
                    )}

                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-plum-900">
                      {profile.summary || 'No redacted summary available.'}
                    </p>

                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-plum-600">Verified skills</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {profile.skills.slice(0, 7).map((s) => (
                          <span key={s} className="rounded-full border border-lavender-200 bg-lavender-50 px-2 py-0.5 text-[10px] font-medium text-plum-900">{s}</span>
                        ))}
                      </div>
                    </div>

                    {profile.match && (
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-lavender-100 bg-ivory p-2.5 text-[11px]">
                        <div>
                          <span className="font-semibold text-mint-700">Matched: </span>
                          <span className="text-plum-900">{profile.match.matchedSkills.slice(0, 3).join(', ') || 'None'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-peach-700">Missing: </span>
                          <span className="text-plum-900">{profile.match.missingRequiredSkills.slice(0, 3).join(', ') || 'None'}</span>
                        </div>
                      </div>
                    )}

                    {profile.integrityReport && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-plum-700">
                        <Radar className="h-3.5 w-3.5 text-accent" />
                        <span>Integrity Radar: <strong>{profile.integrityReport.status}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-lavender-100 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="mint" icon={CheckCircle2} onClick={() => shortlistCandidate(profile, 'shortlisted')}>
                        Shortlist
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => shortlistCandidate(profile, 'screening')}>
                        Request Review
                      </Button>
                      {profile.match && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSelectedMatch({
                              match: profile.match!,
                              blindLabel: profile.revealed ? profile.identity?.name : profile.anonymousId,
                            })
                          }
                        >
                          Evidence
                        </Button>
                      )}
                    </div>
                    {!profile.revealed ? (
                      <Button size="sm" variant="outline" icon={LockOpen} onClick={() => setRevealTarget(profile)}>
                        Reveal Identity
                      </Button>
                    ) : (
                      <Link to={`/recruiter/candidates/${profile.candidateId}`} className="text-xs font-semibold text-accent hover:underline">
                        Full profile
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div
              onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging ? 'border-accent bg-lavender-100/70' : 'border-lavender-200 bg-ivory'
              }`}
            >
              <div className="rounded-2xl border border-lavender-200 bg-white p-3 shadow-sm">
                <UploadCloud className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-plum-950">Drop PDF or DOCX resumes here</h3>
              <p className="mt-1 text-xs text-plum-600">Up to {MAX_FILES} files per batch · Maximum {maxMb} MB each · Magic-byte validated</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              />
              <Button className="mt-4" size="sm" onClick={() => inputRef.current?.click()}>Select resume files</Button>
            </div>

            {queue.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-plum-950">Upload Queue ({completedCount}/{queue.length} processed)</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setQueue([])} disabled={uploading}>Clear</Button>
                    <Button size="sm" loading={uploading} disabled={queue.every((q) => q.status !== 'queued')} onClick={handleUploadAll}>
                      Process & Match Resumes
                    </Button>
                  </div>
                </div>
                <ProgressBar value={progress} />
                <div className="space-y-2">
                  {queue.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-lavender-100 bg-ivory px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-plum-950">{item.file.name}</p>
                          <p className="text-[11px] text-plum-600">
                            {formatFileSize(item.file.size)}
                            {item.result && ` · Parsed: ${item.result.candidate.name} · Integrity: ${item.result.integrityReport?.status ?? 'Checked'}`}
                            {item.error && ` · ${item.error}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'done' && <Badge variant="success"><Check className="h-3 w-3" /> Processed</Badge>}
                        {item.status === 'error' && <Badge variant="danger"><AlertCircle className="h-3 w-3" /> Failed</Badge>}
                        {item.status === 'queued' && <Badge variant="outline">Queued</Badge>}
                        {item.status === 'processing' && <Badge variant="info">Parsing…</Badge>}
                        <button type="button" onClick={() => setQueue((c) => c.filter((q) => q.id !== item.id))} className="p-1 text-plum-600 hover:text-peach-700" aria-label="Remove from queue">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-lavender-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-plum-950">Resume Library ({filteredResumes.length})</h2>
                <p className="text-xs text-plum-600">Private recruiter-only access to uploaded resume documents</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-plum-400" />
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search resumes…"
                  className="h-9 w-full rounded-xl border border-lavender-200 bg-ivory pl-8 pr-3 text-xs text-plum-950 outline-none sm:w-56"
                />
              </div>
            </div>
            {filteredResumes.length === 0 ? (
              <EmptyState className="border-0 bg-transparent py-10" icon={FileText} title="No resumes in library" />
            ) : (
              <div className="divide-y divide-lavender-100">
                {filteredResumes.map((res) => (
                  <div key={res.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-plum-950">{res.originalName}</p>
                        {res.isSample && <SampleTag />}
                        <Badge variant={res.status === 'processed' ? 'success' : 'danger'}>{res.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-plum-600">
                        {res.candidateName ? `${res.candidateName} · ` : ''}{formatFileSize(res.fileSize)} · {formatDateTime(res.createdAt)}
                        {res.errorMessage ? ` · ${res.errorMessage}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {res.status === 'processed' && (
                        <Button size="sm" variant="secondary" icon={Eye} onClick={() => setPreviewId(res.id)}>Inspect Text</Button>
                      )}
                      {!res.isSample && res.status === 'processed' && (
                        <a href={api.resumes.downloadUrl(res.id)} className="inline-flex h-8 items-center gap-1 rounded-xl border border-lavender-200 bg-white px-2.5 text-xs font-medium text-plum-900 hover:bg-lavender-50">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleteResume(res)} aria-label="Delete resume" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Reveal Identity Audited Modal */}
      <Modal
        open={Boolean(revealTarget)}
        onClose={() => setRevealTarget(null)}
        title={`Reveal Identity for ${revealTarget?.anonymousId ?? ''}`}
        description="Identity reveal is permanently recorded in TalentIQ's audit log for fair-hiring accountability."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRevealTarget(null)}>Cancel</Button>
            <Button loading={revealing} onClick={submitReveal}>Confirm & Reveal Identity</Button>
          </div>
        }
      >
        <Field label="Reason for revealing identity *" hint="e.g., Shortlisted for technical interview scheduling">
          <textarea
            className={textareaClass}
            rows={3}
            value={revealReason}
            onChange={(e) => setRevealReason(e.target.value)}
            placeholder="State why identity reveal is needed at this step…"
          />
        </Field>
      </Modal>

      <Modal open={Boolean(previewId)} onClose={() => setPreviewId(null)} title={preview?.originalName ?? 'Resume preview'} size="lg">
        {previewLoading ? <LoadingState label="Loading resume text…" /> : (
          <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-lavender-100 bg-ivory p-4 font-sans text-xs leading-6 text-plum-900">
            {preview?.resumeText || 'No readable text stored.'}
          </pre>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteResume)}
        onClose={() => setDeleteResume(null)}
        onConfirm={handleDeleteResume}
        loading={deletingResume}
        title="Delete resume record?"
        description={`Remove "${deleteResume?.originalName}" from storage?`}
        confirmLabel="Delete"
      />

      <MatchDetailModal
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        match={selectedMatch?.match ?? null}
        job={blindApi.data?.job ?? undefined}
        blindLabel={selectedMatch?.blindLabel}
      />
    </div>
  );
}
