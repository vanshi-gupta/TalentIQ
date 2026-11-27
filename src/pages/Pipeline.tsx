import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, History, Kanban, Plus, Sparkles } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/ui/Modal';
import { AIResultPanel } from '../components/AIResultPanel';
import { Badge, Button, Card, Field, inputClass, ScoreBadge, textareaClass } from '../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/states';
import { formatDateTime, pipelineStageMeta } from '../lib/utils';
import type { AiSuggestion, ApplicationRecord, PipelineStage } from '../types';

const STAGES: { key: PipelineStage; label: string; bg: string }[] = [
  { key: 'applied', label: 'Applied', bg: 'bg-babyblue-100/50 border-[#A7CCF7]' },
  { key: 'screening', label: 'Screening', bg: 'bg-lavender-100/55 border-lavender-200' },
  { key: 'shortlisted', label: 'Shortlisted', bg: 'bg-mint-100/55 border-[#A8DFCA]' },
  { key: 'interview', label: 'Interview', bg: 'bg-butter-100/55 border-[#F2D57A]' },
  { key: 'selected', label: 'Selected', bg: 'bg-mint-100/80 border-[#8AD1B6]' },
  { key: 'not_selected', label: 'Not Selected', bg: 'bg-peach-100/55 border-[#F7BCAA]' },
];

export default function Pipeline() {
  const toast = useToast();
  const [jobId, setJobId] = useState('');
  const jobsApi = useApi(() => api.jobs.list(), []);
  const candidatesApi = useApi(() => api.candidates.list({ pageSize: 100 }), []);
  const pipelineApi = useApi(() => api.screening.pipeline(jobId || undefined), [jobId]);

  const [moveTarget, setMoveTarget] = useState<ApplicationRecord | null>(null);
  const [nextStage, setNextStage] = useState<PipelineStage>('shortlisted');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCandId, setAssignCandId] = useState('');
  const [assignJobId, setAssignJobId] = useState('');
  const [aiBrief, setAiBrief] = useState<AiSuggestion | null>(null);

  const applications = pipelineApi.data?.applications ?? [];
  const history = pipelineApi.data?.history ?? [];

  const openMove = (app: ApplicationRecord) => {
    setMoveTarget(app);
    setNextStage(app.stage);
    setReason('');
    setNotes(app.recruiterNotes ?? '');
  };

  const confirmMove = async () => {
    if (!moveTarget) return;
    setSaving(true);
    try {
      await api.screening.updatePipelineStage(moveTarget.id, {
        stage: nextStage,
        reason: reason.trim() || undefined,
        recruiterNotes: notes.trim() || undefined,
      });
      toast.success(`Moved to ${pipelineStageMeta[nextStage]?.label}.`);
      setMoveTarget(null);
      pipelineApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update stage.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignCandId || !assignJobId) return toast.warning('Select both a candidate and a job.');
    setSaving(true);
    try {
      await api.screening.assignPipeline({ candidateId: assignCandId, jobId: assignJobId, stage: 'screening' });
      toast.success('Candidate added to pipeline.');
      setAssignOpen(false);
      pipelineApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to assign candidate.');
    } finally {
      setSaving(false);
    }
  };

  const loadAiBrief = async () => {
    try {
      setAiBrief(await api.ai.activitySummary());
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to generate activity brief.');
    }
  };

  if (pipelineApi.error) return <ErrorState message={pipelineApi.error} onRetry={pipelineApi.reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Workflow"
        title="Hiring Pipeline"
        description="Track every candidate across Applied, Screening, Shortlisted, Interview, Selected, and Not Selected with full audit history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Sparkles} onClick={loadAiBrief}>AI Pipeline Brief</Button>
            <Button icon={Plus} onClick={() => setAssignOpen(true)}>Add to Pipeline</Button>
          </div>
        }
      />

      {aiBrief && <div className="mb-5"><AIResultPanel result={aiBrief} onDismiss={() => setAiBrief(null)} /></div>}

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-plum-950">Filter by Job Opening</p>
          <select className={`${inputClass} sm:w-80`} value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter pipeline by job">
            <option value="">All job openings ({applications.length})</option>
            {(jobsApi.data?.jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
      </Card>

      {pipelineApi.loading ? (
        <LoadingState label="Loading hiring pipeline…" />
      ) : applications.length === 0 ? (
        <Card>
          <EmptyState
            className="border-0 bg-transparent py-14"
            icon={Kanban}
            title="Your hiring pipeline is empty"
            description="Candidates appear here when they apply or when you assign them from Screening."
            action={<Button size="sm" icon={Plus} onClick={() => setAssignOpen(true)}>Assign Candidate to Job</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((col) => {
            const items = applications.filter((a) => a.stage === col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 ${col.bg}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-plum-950">{col.label}</h2>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-lavender-200 bg-white/60 px-3 py-5 text-center text-xs text-plum-600">
                      No candidates in {col.label}
                    </p>
                  ) : (
                    items.map((app) => (
                      <div key={app.id} className="rounded-xl border border-lavender-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link to={`/recruiter/candidates/${app.candidateId}`} className="truncate text-sm font-bold text-plum-950 hover:text-accent">
                              {app.candidate?.name ?? 'Candidate'}
                            </Link>
                            <p className="truncate text-xs text-plum-600">{app.job?.title ?? 'Job Opening'}</p>
                          </div>
                          {app.match && <ScoreBadge score={app.match.overallScore} />}
                        </div>
                        {app.rejectionReason && (
                          <p className="mt-2 rounded-lg bg-peach-100/60 px-2.5 py-1 text-[11px] text-peach-700">
                            Reason: {app.rejectionReason}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-lavender-100 pt-2.5">
                          <span className="text-[10px] text-plum-600">{formatDateTime(app.updatedAt)}</span>
                          <Button size="sm" variant="secondary" onClick={() => openMove(app)}>
                            Move Stage <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stage History Audit Log */}
      {history.length > 0 && (
        <Card className="mt-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-plum-950">Stage Change Audit Trail</h2>
          </div>
          <div className="divide-y divide-lavender-100">
            {history.slice(0, 10).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                <div className="text-plum-900">
                  <span className="font-semibold">{item.from_stage ?? 'New'}</span> → <span className="font-bold text-accent">{item.to_stage}</span>
                  {item.reason && <span className="ml-2 text-plum-600">· “{item.reason}”</span>}
                </div>
                <span className="text-[11px] text-plum-600">
                  {item.changed_by_name ?? 'System'} · {formatDateTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Move Stage Modal */}
      <Modal
        open={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title={`Update Pipeline Stage — ${moveTarget?.candidate?.name ?? ''}`}
        description="Stage transitions update candidate application status (internal notes remain hidden from candidates)."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveTarget(null)}>Cancel</Button>
            <Button loading={saving} onClick={confirmMove}>Save Stage</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Target stage">
            <select className={inputClass} value={nextStage} onChange={(e) => setNextStage(e.target.value as PipelineStage)}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Reason / feedback note (optional)">
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Strong React architecture skills" />
          </Field>
          <Field label="Confidential recruiter notes (never shown to candidate)">
            <textarea className={textareaClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal interview rubric notes…" />
          </Field>
        </div>
      </Modal>

      {/* Assign Candidate Modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Add Candidate to Job Pipeline"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleAssign}>Add & Match</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Candidate *">
            <select className={inputClass} value={assignCandId} onChange={(e) => setAssignCandId(e.target.value)}>
              <option value="">Choose candidate…</option>
              {(candidatesApi.data?.candidates ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Job Opening *">
            <select className={inputClass} value={assignJobId} onChange={(e) => setAssignJobId(e.target.value)}>
              <option value="">Choose job…</option>
              {(jobsApi.data?.jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
