import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { AiSuggestion, CandidateStage, ResumeRecord, StoredMatch } from '../types';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { CandidateFormModal } from '../components/forms/CandidateFormModal';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { AIResultPanel } from '../components/AIResultPanel';
import { IntegrityRadarCard } from '../components/IntegrityRadarCard';
import { Avatar, Badge, Button, Card, SampleTag, ScoreRing } from '../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/states';
import { MatchDetailModal } from '../components/MatchDetailModal';
import { formatDate, formatFileSize, matchRecommendation, stageMeta } from '../lib/utils';

const stages: CandidateStage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-plum-950">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-plum-600">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => api.candidates.get(id as string), [id], { enabled: Boolean(id) });
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<StoredMatch | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResumeRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

  const changeStage = async (stage: CandidateStage) => {
    if (!data || stage === data.stage) return;
    setStageUpdating(true);
    try {
      await api.candidates.updateStage(data.id, stage);
      toast.success(`${data.name} moved to ${stageMeta[stage]?.label}.`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update stage.');
    } finally {
      setStageUpdating(false);
    }
  };

  const runAi = async (kind: 'summary' | 'questions' | 'feedback') => {
    if (!data) return;
    setAiLoading(true);
    try {
      const latestJobId = data.matches[0]?.jobId;
      let res: AiSuggestion;
      if (kind === 'summary') {
        res = await api.ai.summarizeCandidate(data.id);
      } else if (kind === 'questions' && latestJobId) {
        res = await api.ai.interviewQuestions(data.id, latestJobId);
      } else if (kind === 'feedback' && latestJobId) {
        res = await api.ai.draftFeedback(data.id, latestJobId, 'encouraging');
      } else {
        res = await api.ai.summarizeCandidate(data.id);
      }
      setAiResult(res);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to run assistant.');
    } finally {
      setAiLoading(false);
    }
  };

  const deleteCandidate = async () => {
    if (!data) return;
    setDeleting(true);
    try {
      await api.candidates.remove(data.id);
      toast.success(`${data.name} was deleted.`);
      navigate('/recruiter/candidates');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to delete candidate.');
      setDeleting(false);
    }
  };

  if (loading && !data) return <LoadingState label="Loading candidate profile…" />;
  if (error || !data) return <ErrorState message={error ?? 'Candidate not found.'} onRetry={reload} />;

  return (
    <div>
      <Link to="/recruiter/candidates" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-plum-700 transition hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar name={data.name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-plum-950">{data.name}</h1>
                {data.isSample && <SampleTag />}
              </div>
              <p className="mt-1 text-sm font-medium text-plum-700">{data.title || 'Job title not specified'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-plum-600">
                {data.email && <a href={`mailto:${data.email}`} className="flex items-center gap-1.5 hover:text-accent"><Mail className="h-3.5 w-3.5 text-accent" />{data.email}</a>}
                {data.phone && <a href={`tel:${data.phone}`} className="flex items-center gap-1.5 hover:text-accent"><Phone className="h-3.5 w-3.5 text-accent" />{data.phone}</a>}
                {data.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-accent" />{data.location}</span>}
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-accent" />Added {formatDate(data.createdAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  value={data.stage}
                  disabled={stageUpdating}
                  onChange={(e) => changeStage(e.target.value as CandidateStage)}
                  className={`h-8 rounded-full border px-3 text-xs font-semibold outline-none transition ${stageMeta[data.stage]?.className ?? ''}`}
                  aria-label="Hiring stage"
                >
                  {stages.map((s) => <option key={s} value={s}>{stageMeta[s].label}</option>)}
                </select>
                <span className="text-xs font-medium text-plum-700">{data.yearsExperience || 0} years experience</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" icon={Sparkles} loading={aiLoading} onClick={() => runAi('summary')}>AI Evidence Brief</Button>
            {data.matches.length > 0 && (
              <>
                <Button variant="secondary" size="sm" icon={MessageSquarePlus} loading={aiLoading} onClick={() => runAi('questions')}>Questions</Button>
                <Button variant="secondary" size="sm" loading={aiLoading} onClick={() => runAi('feedback')}>Draft Feedback</Button>
              </>
            )}
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        </div>
      </Card>

      {aiResult && <div className="mt-5"><AIResultPanel result={aiResult} onDismiss={() => setAiResult(null)} /></div>}

      {data.integrityReport && (
        <div className="mt-5">
          <IntegrityRadarCard report={data.integrityReport} perspective="recruiter" />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <Section title="Profile summary">
            <p className="whitespace-pre-wrap text-sm leading-6 text-plum-900">
              {data.summary || 'No summary has been added yet.'}
            </p>
          </Section>

          <Section title="Skills" action={<Badge variant="violet">{data.skills.length}</Badge>}>
            {data.skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-lavender-200 bg-lavender-50 px-3 py-1 text-xs font-medium text-plum-950">{skill}</span>
                ))}
              </div>
            ) : <p className="text-xs text-plum-600">No skills detected yet.</p>}
          </Section>

          <Section title="Work experience" description={`${data.yearsExperience || 0} years total`}>
            {data.experience.length ? (
              <div className="space-y-4">
                {data.experience.map((exp, idx) => (
                  <div key={idx} className="rounded-2xl border border-lavender-100 bg-ivory p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-plum-950">{exp.title}</p>
                      <span className="text-xs font-medium text-plum-600">{exp.start || '?'} – {exp.end || '?'}</span>
                    </div>
                    {exp.company && <p className="mt-0.5 text-xs font-semibold text-accent">{exp.company}</p>}
                    {exp.description && <p className="mt-2 text-xs leading-5 text-plum-900">{exp.description}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-plum-600">No dated employment entries detected.</p>}
          </Section>

          <Section title="Education">
            {data.education.length ? (
              <div className="space-y-3">
                {data.education.map((edu, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-2xl border border-lavender-100 bg-ivory p-3.5">
                    <GraduationCap className="mt-0.5 h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-bold text-plum-950">{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p>
                      <p className="text-xs text-plum-600">{[edu.institution, edu.year].filter(Boolean).join(' · ') || 'Details not listed'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-plum-600">No education records detected.</p>}
          </Section>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <Section title="Job Matches & Evidence Ledger" description="Click any match to inspect supporting resume excerpts">
            {data.matches.length === 0 ? (
              <EmptyState title="No matches yet" description="Run matching from any Job opening page." />
            ) : (
              <div className="space-y-3">
                {data.matches.map((match) => (
                  <div key={match.id} className="rounded-2xl border border-lavender-200 bg-ivory p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-plum-950">{match.job?.title ?? 'Job Opening'}</p>
                        <p className="mt-0.5 text-xs text-plum-600">{matchRecommendation(match.overallScore)}</p>
                      </div>
                      <ScoreRing score={match.overallScore} size={56} stroke={5} />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedMatch(match)}>Open Match DNA & Evidence</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Uploaded Resumes">
            {data.resumes.length === 0 ? (
              <p className="text-xs text-plum-600">No resume files attached.</p>
            ) : (
              <div className="space-y-2.5">
                {data.resumes.map((res) => (
                  <div key={res.id} className="flex items-center justify-between gap-2 rounded-xl border border-lavender-100 bg-ivory p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-plum-950">{res.originalName}</p>
                        <p className="text-[11px] text-plum-600">{res.fileType.toUpperCase()} · {formatFileSize(res.fileSize)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" icon={Eye} onClick={() => setPreviewId(res.id)}>Text</Button>
                      {!res.isSample && (
                        <a href={api.resumes.downloadUrl(res.id)} className="inline-flex h-8 items-center gap-1 rounded-xl border border-lavender-200 bg-white px-2.5 text-xs font-medium text-plum-900 hover:bg-lavender-50">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <Modal open={Boolean(previewId)} onClose={() => setPreviewId(null)} title={preview?.originalName ?? 'Resume text'} size="lg">
        {previewLoading ? <LoadingState label="Extracting preview…" /> : (
          <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-lavender-100 bg-ivory p-4 font-sans text-xs leading-6 text-plum-900">
            {preview?.resumeText || 'No parsed text available.'}
          </pre>
        )}
      </Modal>

      <CandidateFormModal open={editOpen} onClose={() => setEditOpen(false)} candidate={data} onSaved={reload} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteCandidate}
        loading={deleting}
        title="Delete candidate?"
        description={`Remove ${data.name} and any uploaded resumes permanently?`}
        confirmLabel="Delete candidate"
      />
      <MatchDetailModal open={Boolean(selectedMatch)} onClose={() => setSelectedMatch(null)} match={selectedMatch} candidate={data} />
    </div>
  );
}
