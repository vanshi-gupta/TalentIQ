import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  FileText,
  Info,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { MatchWeights } from '../types';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ui/Modal';
import { Badge, Button, Card, inputClass, Toggle } from '../components/ui/primitives';
import { ErrorState, LoadingState } from '../components/ui/states';

const DEFAULT_WEIGHTS: MatchWeights = { skills: 55, experience: 25, education: 10, keywords: 10 };

const weightMeta: { key: keyof MatchWeights; label: string; help: string }[] = [
  { key: 'skills', label: 'Skills', help: 'Required and preferred skills on the candidate profile.' },
  { key: 'experience', label: 'Experience', help: 'Total years of experience compared with the job.' },
  { key: 'education', label: 'Education', help: 'Highest qualification compared with the requirement.' },
  { key: 'keywords', label: 'Job description', help: 'Terminology overlap with the job description.' },
];

export default function Settings() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(api.settings.get, []);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [weights, setWeights] = useState<MatchWeights>(DEFAULT_WEIGHTS);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [model, setModel] = useState('gemini-2.0-flash');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!data) return;
    setWeights(data.weights);
    setAiEnabled(data.ai.enabled);
    setModel(data.ai.model);
  }, [data]);

  const total = weights.skills + weights.experience + weights.education + weights.keywords;
  const dirty = Boolean(
    data &&
      (weights.skills !== data.weights.skills ||
        weights.experience !== data.weights.experience ||
        weights.education !== data.weights.education ||
        weights.keywords !== data.weights.keywords ||
        aiEnabled !== data.ai.enabled ||
        model.trim() !== data.ai.model),
  );
  const sample = data?.sampleData ?? { candidates: 0, jobs: 0, resumes: 0 };
  const sampleTotal = sample.candidates + sample.jobs + sample.resumes;
  const keyConfigured = Boolean(data?.system.aiKeyConfigured || data?.apiKeyConfigured);

  const updateWeight = (key: keyof MatchWeights, value: number) => {
    setWeights((current) => ({ ...current, [key]: Math.max(0, Math.min(100, Math.round(value))) }));
  };

  const save = async () => {
    setFormError(null);
    if (total !== 100) return setFormError('The four matching weights must add up to 100%.');
    if (!model.trim()) return setFormError('Enter a model name for optional AI suggestions.');
    setSaving(true);
    try {
      const result = await api.settings.update({ weights, ai: { enabled: aiEnabled, model: model.trim() } });
      setData(result);
      toast.success('Settings saved.');
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const testAi = async () => {
    setTesting(true);
    try {
      await api.ai.test();
      toast.success('Live Gemini connection verified.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'AI connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const res = await api.settings.seedDemoData();
      setData(res);
      toast.success('Demo dataset loaded with clear Demo tags.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to load demo data.');
    } finally {
      setSeeding(false);
    }
  };

  const removeSampleData = async () => {
    setRemoving(true);
    try {
      const result = await api.settings.removeDemoData();
      const removed = Object.values(result.removed).reduce((sum, value) => sum + value, 0);
      toast.success('Demo data removed.', removed ? `${removed} demo records deleted.` : 'No demo data found.');
      setRemoveOpen(false);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to remove demo data.');
    } finally {
      setRemoving(false);
    }
  };

  if (loading && !data) return <LoadingState label="Loading settings…" />;
  if (error || !data) return <ErrorState message={error ?? 'Settings could not be loaded.'} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Recruiter Workspace"
        title="Settings & Governance"
        description="Configure deterministic scoring weights, optional Gemini AI, and demo walkthrough records."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-plum-950">Workspace & Security</h2>
          </div>
          <div className="mt-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <div><p className="font-semibold text-plum-950">Database Engine</p><p className="text-plum-600">Local SQLite with WAL & foreign-key enforcement</p></div>
              <Badge variant="info">SQLite</Badge>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-lavender-100 pt-3">
              <div><p className="font-semibold text-plum-950">Upload Limit</p><p className="text-plum-600">PDF & DOCX validated by magic bytes</p></div>
              <span className="font-bold text-plum-950">{data.system.maxUploadMb} MB</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-lavender-100 pt-3">
              <div><p className="font-semibold text-plum-950">Privacy & Blind Review</p><p className="text-plum-600">Resumes are private; identity reveals are audited</p></div>
              <ShieldCheck className="h-4 w-4 shrink-0 text-mint-700" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-plum-950">Demo Data Mode</h2>
            {sampleTotal > 0 && <Badge variant="sample">Demo Active</Badge>}
          </div>
          {sampleTotal > 0 ? (
            <>
              <p className="mt-3 text-xs leading-5 text-plum-700">
                This workspace currently contains optional demo records ({sample.candidates} candidates, {sample.jobs} jobs, {sample.resumes} resumes). Real user records are preserved separately.
              </p>
              <Button variant="danger" size="sm" icon={Trash2} className="mt-4" onClick={() => setRemoveOpen(true)}>
                Remove Demo Data
              </Button>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-mint-700">
                <CheckCircle2 className="h-4 w-4" /> Workspace contains only real records
              </div>
              <p className="mt-2 text-xs leading-5 text-plum-600">
                You can optionally load labelled Indian demo records if your workspace is empty.
              </p>
              <Button variant="secondary" size="sm" className="mt-3" loading={seeding} onClick={seedDemo}>
                Load Optional Demo Data
              </Button>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <button type="button" onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-0.5 h-4 w-4 text-accent" />
            <span>
              <span className="block text-sm font-bold text-plum-950">Deterministic Match Weights & AI Assistant</span>
              <span className="mt-0.5 block text-xs text-plum-600">AI never alters deterministic match scores; local deterministic fallback works without an API key.</span>
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-plum-600 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        {advancedOpen && (
          <div className="border-t border-lavender-100 px-5 py-5">
            {formError && <div className="mb-4 rounded-xl border border-[#F7BCAA] bg-peach-100 px-3.5 py-3 text-sm text-peach-700">{formError}</div>}

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-plum-950">Dimension Weights</h3>
                    <p className="mt-0.5 text-xs text-plum-600">Applied across all deterministic matches.</p>
                  </div>
                  <Badge variant={total === 100 ? 'success' : 'warning'}>{total}% of 100</Badge>
                </div>
                <div className="mt-4 space-y-4">
                  {weightMeta.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label htmlFor={`weight-${item.key}`} className="text-xs font-semibold text-plum-950">{item.label}</label>
                          <p className="text-[11px] text-plum-600">{item.help}</p>
                        </div>
                        <span className="w-12 rounded-lg border border-lavender-200 bg-lavender-50 py-1 text-center text-xs font-bold tabular-nums text-plum-950">
                          {weights[item.key]}%
                        </span>
                      </div>
                      <input id={`weight-${item.key}`} type="range" min="0" max="100" step="1" value={weights[item.key]} onChange={(e) => updateWeight(item.key, Number(e.target.value))} className="mt-2 w-full cursor-pointer" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className={`text-[11px] font-medium ${total === 100 ? 'text-mint-700' : 'text-peach-700'}`}>
                    {total === 100 ? 'Weights add up to 100%.' : `Adjust by ${Math.abs(100 - total)} points to reach 100%.`}
                  </span>
                  <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                    <RotateCcw className="h-3 w-3" /> Reset defaults
                  </button>
                </div>
              </div>

              <div className="border-t border-lavender-100 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-plum-950"><Sparkles className="h-3.5 w-3.5 text-accent" />Optional Gemini Enhancement</h3>
                    <p className="mt-0.5 text-xs text-plum-600">When off or unconfigured, TalentIQ uses its Deterministic Local Assistant.</p>
                  </div>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} label="Enable Gemini AI" />
                </div>
                <div className="mt-4">
                  <label htmlFor="ai-model" className="mb-2 block text-xs font-semibold text-plum-900">Gemini Model</label>
                  <input id="ai-model" list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
                  <datalist id="ai-models">
                    <option value="gemini-2.0-flash" />
                    <option value="gemini-2.0-flash-lite" />
                    <option value="gemini-1.5-flash" />
                    <option value="gemini-1.5-pro" />
                  </datalist>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-lavender-100 bg-ivory px-3 py-2.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <p className="text-[11px] leading-5 text-plum-700">
                    {keyConfigured
                      ? 'GEMINI_API_KEY is configured on the server (never exposed to browser).'
                      : 'GEMINI_API_KEY is not set. TalentIQ automatically uses its deterministic local fallback.'}
                  </p>
                </div>
                <div className="mt-3">
                  <Button variant="secondary" size="sm" icon={Bot} loading={testing} disabled={!keyConfigured || !aiEnabled} onClick={testAi}>
                    Test Live Gemini Key
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-lavender-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-plum-600">{dirty ? 'You have unsaved changes.' : 'All settings are saved.'}</p>
              <div className="flex items-center gap-2">
                {dirty && <Button variant="ghost" size="sm" onClick={() => { setWeights(data.weights); setAiEnabled(data.ai.enabled); setModel(data.ai.model); setFormError(null); }}>Discard</Button>}
                <Button size="sm" icon={Save} loading={saving} disabled={!dirty || total !== 100} onClick={save}>Save Settings</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={removeSampleData}
        loading={removing}
        title="Remove demo data?"
        description="This removes only records tagged as Demo data. All real candidates, jobs, applications, and payments remain untouched."
        confirmLabel="Remove demo data"
      />
    </div>
  );
}
