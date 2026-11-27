import { useState } from 'react';
import { CheckCircle2, Circle, Compass, GraduationCap, Lightbulb, RefreshCw, Target } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Button, Card, inputClass, ProgressBar } from '../../components/ui/primitives';
import { ErrorState, LoadingState } from '../../components/ui/states';

export default function CareerGrowth() {
  const toast = useToast();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [targetRoleInput, setTargetRoleInput] = useState('');

  const jobsApi = useApi(() => api.candidate.jobs(), []);
  const gapsApi = useApi(() => api.candidate.skillGaps(selectedJobId || undefined), [selectedJobId]);
  const roadmapApi = useApi(() => api.candidate.roadmap(), []);

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    try {
      const res = await api.candidate.toggleMilestone(milestoneId, completed);
      roadmapApi.setData(res);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update milestone.');
    }
  };

  const regenerateRoadmap = async () => {
    if (!targetRoleInput.trim()) return toast.warning('Enter a target role first.');
    try {
      const res = await api.candidate.roadmap(targetRoleInput.trim());
      roadmapApi.setData(res);
      toast.success(`Career roadmap updated for ${res.roadmap.targetRole}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update roadmap.');
    }
  };

  if (gapsApi.error) return <ErrorState message={gapsApi.error} onRetry={gapsApi.reload} />;

  const roadmap = roadmapApi.data?.roadmap;
  const completedCount = roadmap?.milestones.filter((m) => m.completed).length ?? 0;
  const totalCount = roadmap?.milestones.length ?? 0;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate Growth Engine"
        title="Skill Gap Analyzer & Career Roadmap"
        description="Identify missing skills honestly, build practical portfolio projects, and track milestones toward your target role."
      />

      {/* Skill Gap Analyzer */}
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-lavender-100 p-2 text-accent">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-plum-950">Skill Gap Analyzer</h2>
              <p className="text-xs text-plum-600">Actionable gaps based on real open roles — we never fabricate course completions or certifications.</p>
            </div>
          </div>
          <select className={`${inputClass} sm:w-72`} value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} aria-label="Target job for skill gap">
            <option value="">Across all active roles</option>
            {(jobsApi.data?.jobs ?? []).map(({ job }) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>

        {gapsApi.loading ? (
          <LoadingState label="Analyzing skill gaps…" />
        ) : (gapsApi.data?.gaps ?? []).length === 0 ? (
          <div className="mt-4 rounded-2xl border border-[#A8DFCA] bg-mint-100/50 p-4 text-xs font-medium text-mint-700">
            Your skills already cover the core requirements of this target! Focus on deepening project impact and interview prep.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {(gapsApi.data?.gaps ?? []).map((gap) => (
              <div key={gap.skill} className="rounded-2xl border border-lavender-200 bg-ivory p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-plum-950">{gap.skill}</h3>
                  <Badge variant={gap.priority === 'required' ? 'danger' : 'warning'}>
                    {gap.priority === 'required' ? 'High Priority' : 'Preferred'}
                  </Badge>
                </div>
                <p className="text-xs text-plum-800"><strong>Why it matters:</strong> {gap.whyItMatters}</p>
                <p className="text-xs text-plum-700"><strong>Current status:</strong> {gap.currentLevel}</p>
                <div className="rounded-xl border border-lavender-100 bg-white p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-accent flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Practical Project Idea</p>
                  <p className="text-plum-900">{gap.projectIdea}</p>
                  <p className="text-[11px] text-plum-600"><strong>How to demonstrate:</strong> {gap.demonstrationTip}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Career Growth Roadmap */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-mint-100 p-2 text-mint-700">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-plum-950">
                Career Growth Roadmap {roadmap ? `· ${roadmap.targetRole}` : ''}
              </h2>
              <p className="text-xs text-plum-600">Check off milestones as you complete projects and strengthen fundamentals.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className={`${inputClass} sm:w-56`}
              value={targetRoleInput}
              onChange={(e) => setTargetRoleInput(e.target.value)}
              placeholder="Target role (e.g. Full Stack)"
            />
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={regenerateRoadmap}>Update</Button>
          </div>
        </div>

        {roadmap && (
          <>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-plum-900">
              <span>Progress: {completedCount} of {totalCount} milestones completed</span>
              <span>{pct}%</span>
            </div>
            <ProgressBar value={pct} color="#236B50" className="mt-2" height="h-2.5" />

            <div className="mt-5 space-y-3">
              {roadmap.milestones.map((ms) => (
                <button
                  key={ms.id}
                  type="button"
                  onClick={() => toggleMilestone(ms.id, !ms.completed)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    ms.completed
                      ? 'border-[#A8DFCA] bg-mint-100/45'
                      : 'border-lavender-200 bg-ivory hover:bg-lavender-50/70'
                  }`}
                >
                  {ms.completed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint-700" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-plum-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-bold ${ms.completed ? 'text-mint-700 line-through' : 'text-plum-950'}`}>
                        {ms.title}
                      </span>
                      <Badge variant="violet">{ms.skill}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-plum-700">{ms.description}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent">
                      <Compass className="h-3 w-3" /> Project: {ms.projectIdea}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
