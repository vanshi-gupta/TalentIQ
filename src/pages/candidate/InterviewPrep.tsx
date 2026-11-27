import { useState } from 'react';
import { BookOpenCheck, CheckCircle2, Circle, MessageSquareText } from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/PageHeader';
import { Badge, Card, inputClass } from '../../components/ui/primitives';
import { ErrorState, LoadingState } from '../../components/ui/states';

export default function InterviewPrep() {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const jobsApi = useApi(() => api.candidate.jobs(), []);
  const prepApi = useApi(() => api.candidate.interviewPrep(selectedJobId || undefined), [selectedJobId]);

  const toggleCheck = (id: string) => setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  if (prepApi.error) return <ErrorState message={prepApi.error} onRetry={prepApi.reload} />;

  const prep = prepApi.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate Preparation"
        title="Interview Preparation"
        description="Practice role-specific technical and behavioral questions with structured STAR frameworks and a revision checklist."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-plum-950">Prepare for Specific Job Opening</p>
            <p className="text-[11px] text-plum-600">Questions adapt to the job's required skills and your profile gaps.</p>
          </div>
          <select className={`${inputClass} sm:w-80`} value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} aria-label="Target job for interview prep">
            <option value="">Default target role</option>
            {(jobsApi.data?.jobs ?? []).map(({ job }) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>
      </Card>

      {prepApi.loading || !prep ? (
        <LoadingState label="Generating role-specific interview guide…" />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-base font-bold text-plum-950">Technical Questions · {prep.roleTitle}</h2>
                </div>
                <Badge variant="violet">{prep.technicalQuestions.length}</Badge>
              </div>
              <div className="space-y-3">
                {prep.technicalQuestions.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-lavender-100 bg-ivory p-4">
                    <Badge variant="info">{item.focusSkill}</Badge>
                    <p className="mt-2 text-sm font-bold text-plum-950">{item.question}</p>
                    <p className="mt-2 text-xs leading-5 text-plum-700">
                      <strong className="text-accent">Suggested structure:</strong> {item.answerStructure}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-mint-700" />
                  <h2 className="font-display text-base font-bold text-plum-950">Behavioral Questions (STAR)</h2>
                </div>
                <Badge variant="success">{prep.behavioralQuestions.length}</Badge>
              </div>
              <div className="space-y-3">
                {prep.behavioralQuestions.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-lavender-100 bg-ivory p-4">
                    <Badge variant="success">{item.competency}</Badge>
                    <p className="mt-2 text-sm font-bold text-plum-950">{item.question}</p>
                    <p className="mt-2 text-xs leading-5 text-plum-700">
                      <strong className="text-mint-700">Answer structure:</strong> {item.answerStructure}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-display text-base font-bold text-plum-950">Key Areas to Revise</h2>
              <ul className="mt-3 space-y-2">
                {prep.areasToRevise.map((topic, idx) => (
                  <li key={idx} className="rounded-xl border border-lavender-100 bg-ivory px-3.5 py-2.5 text-xs font-medium text-plum-900">
                    • {topic}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="font-display text-base font-bold text-plum-950">Practice Checklist</h2>
              <div className="mt-3 space-y-2.5">
                {prep.practiceChecklist.map((item) => {
                  const done = Boolean(checkedIds[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCheck(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs font-medium transition ${
                        done ? 'border-[#A8DFCA] bg-mint-100/50 text-mint-700' : 'border-lavender-100 bg-ivory text-plum-900 hover:bg-lavender-50'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-mint-700" /> : <Circle className="h-4 w-4 shrink-0 text-plum-400" />}
                      <span className={done ? 'line-through' : ''}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
