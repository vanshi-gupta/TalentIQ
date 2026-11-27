import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  IndianRupee,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { Badge, Button, Card, Field, inputClass, ScoreBadge, textareaClass } from '../../components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { experienceRange, formatSalaryRangeInr } from '../../lib/utils';
import type { AlternativeJobRecommendation, Job, MatchResult } from '../../types';

export default function FindJobs() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [maxExperience, setMaxExperience] = useState('');
  const [minSalary, setMinSalary] = useState('');

  const jobsApi = useApi(
    () =>
      api.candidate.jobs({
        search: search.trim() || undefined,
        location: location.trim() || undefined,
        employmentType: employmentType || undefined,
        maxExperience: maxExperience ? Number(maxExperience) : undefined,
        minSalary: minSalary ? Number(minSalary) : undefined,
      }),
    [search, location, employmentType, maxExperience, minSalary],
  );
  const recsApi = useApi(() => api.candidate.recommendations(), []);

  const [detailTarget, setDetailTarget] = useState<{ job: Job; match: MatchResult; saved: boolean; applicationStage: string | null } | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [altModal, setAltModal] = useState<{ recommendations: AlternativeJobRecommendation[]; skillSuggestions: Array<{ missingSkill: string; projectIdea: string; demonstrationTip: string }> } | null>(null);

  const items = jobsApi.data?.jobs ?? [];
  const recommendations = recsApi.data?.recommendations ?? [];
  const skillSuggestions = recsApi.data?.skillSuggestions ?? [];

  const toggleSave = async (jobId: string, currentlySaved: boolean) => {
    try {
      if (currentlySaved) {
        await api.candidate.unsaveJob(jobId);
        toast.info('Removed from saved jobs.');
      } else {
        await api.candidate.saveJob(jobId);
        toast.success('Job saved!');
      }
      jobsApi.reload();
      recsApi.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to update saved job.');
    }
  };

  const applyForJob = async (jobId: string) => {
    setApplying(true);
    try {
      const res = await api.candidate.apply(jobId, coverNote.trim() || undefined);
      toast.success(`Application submitted for ${res.application.job?.title ?? 'job'}!`);
      setDetailTarget(null);
      setCoverNote('');
      jobsApi.reload();
      recsApi.reload();
      if (res.alternatives) {
        setAltModal(res.alternatives);
      }
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to apply.');
    } finally {
      setApplying(false);
    }
  };

  if (jobsApi.error) return <ErrorState message={jobsApi.error} onRetry={jobsApi.reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Opportunity Discovery"
        title="Find Jobs & Alternative Opportunities"
        description="See transparent match explanations before applying, save roles, and explore transferable-skill recommendations."
      />

      {/* Search & Filters */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-400" />
            <input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search role, company, or skill…" />
          </div>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Bengaluru)" />
          <select className={inputClass} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
            <option value="">All types</option>
            <option value="Full-time">Full-time</option>
            <option value="Internship">Internship</option>
            <option value="Contract">Contract</option>
          </select>
          <select className={inputClass} value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)}>
            <option value="">Any experience</option>
            <option value="1">0–1 yrs</option>
            <option value="3">Up to 3 yrs</option>
            <option value="5">Up to 5 yrs</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-plum-700">
            <span>Min CTC:</span>
            <select className="h-8 rounded-lg border border-lavender-200 bg-ivory px-2 text-xs text-plum-950" value={minSalary} onChange={(e) => setMinSalary(e.target.value)}>
              <option value="">Any</option>
              <option value="500000">₹5+ LPA</option>
              <option value="800000">₹8+ LPA</option>
              <option value="1200000">₹12+ LPA</option>
            </select>
          </div>
          {(search || location || employmentType || maxExperience || minSalary) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setLocation(''); setEmploymentType(''); setMaxExperience(''); setMinSalary(''); }}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Active Jobs List */}
      {jobsApi.loading ? (
        <LoadingState label="Matching active jobs to your profile…" />
      ) : items.length === 0 ? (
        <Card className="mb-6">
          <EmptyState
            className="border-0 bg-transparent py-12"
            icon={BriefcaseBusiness}
            title="No active jobs match these filters"
            description="Try widening your location or salary filter, or explore your personalized skill growth suggestions below."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(({ job, match, saved, applicationStage }) => (
            <Card key={job.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-plum-950">{job.title}</h3>
                    <p className="text-xs font-medium text-plum-700">{job.company} · {job.workMode} · {job.employmentType}</p>
                  </div>
                  <ScoreBadge score={match.overallScore} />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-plum-600">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" />{job.location || 'India'}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-mint-700"><IndianRupee className="h-3 w-3" />{formatSalaryRangeInr(job.salaryMinInr, job.salaryMaxInr).replace(/^₹/, '')}</span>
                  <span>{experienceRange(job.minExperience, job.maxExperience, true)}</span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <p className="text-plum-900">
                    <strong className="text-mint-700">Why you match:</strong>{' '}
                    {match.matchedSkills.length ? match.matchedSkills.slice(0, 4).join(', ') : 'Transferable profile background'}
                  </p>
                  {match.missingSkills.length > 0 && (
                    <p className="text-plum-700">
                      <strong className="text-peach-700">Skills to build:</strong> {match.missingSkills.slice(0, 4).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-lavender-100 pt-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDetailTarget({ job, match, saved, applicationStage })}>
                    View Job
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={saved ? BookmarkCheck : Bookmark}
                    onClick={() => toggleSave(job.id, saved)}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                </div>
                {applicationStage ? (
                  <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Applied ({applicationStage})</Badge>
                ) : (
                  <Button size="sm" onClick={() => setDetailTarget({ job, match, saved, applicationStage })}>
                    Apply Now
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Alternative Job Finder — Opportunity Beyond Rejection */}
      <Card className="mt-8 bg-gradient-to-br from-lavender-50 via-white to-mint-100/40 p-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-white p-2 text-accent shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-plum-950">Alternative Job Finder — Opportunity Beyond Rejection</h2>
            <p className="text-xs text-plum-700">
              Adjacent roles ranked using your existing and transferable skills from genuine TalentIQ openings.
            </p>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {recommendations.map((rec) => (
              <div key={rec.job.id} className="rounded-2xl border border-lavender-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-bold text-plum-950">{rec.job.title}</p>
                    <p className="text-xs text-plum-600">{rec.job.company} · {rec.job.location} · {rec.job.employmentType}</p>
                    <p className="text-[11px] font-semibold text-mint-700">{formatSalaryRangeInr(rec.job.salaryMinInr, rec.job.salaryMaxInr)}</p>
                  </div>
                  <ScoreBadge score={rec.matchScore} />
                </div>
                <p className="mt-2 text-xs text-plum-900"><strong>Why recommended:</strong> {rec.whyRecommended}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rec.matchingSkills.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-full border border-[#A8DFCA] bg-mint-100 px-2 py-0.5 text-[10px] font-medium text-mint-700">{s}</span>
                  ))}
                  {rec.transferableSkills.slice(0, 2).map((s) => (
                    <span key={s} className="rounded-full border border-[#A7CCF7] bg-babyblue-100 px-2 py-0.5 text-[10px] font-medium text-babyblue-700">Transferable: {s}</span>
                  ))}
                </div>
                {rec.bridgeAction && (
                  <div className="mt-3 rounded-xl border border-lavender-100 bg-ivory p-2.5 text-[11px] text-plum-800">
                    <span className="font-bold text-accent">Skill-to-Opportunity Bridge ({rec.bridgeAction.missingSkill}): </span>
                    {rec.bridgeAction.projectIdea}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => {
                    const matched = items.find((i) => i.job.id === rec.job.id);
                    if (matched) setDetailTarget(matched);
                  }}>View Job</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleSave(rec.job.id, rec.saved)}>
                    {rec.saved ? 'Saved' : 'Save Job'}
                  </Button>
                  {!rec.alreadyApplied && (
                    <Button size="sm" onClick={() => applyForJob(rec.job.id)}>Apply Now</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-plum-800">
              No close alternative job openings matched your current profile yet. Focus on these practical skill-development projects:
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {skillSuggestions.map((s) => (
                <div key={s.missingSkill} className="rounded-xl border border-lavender-200 bg-white p-3.5 text-xs">
                  <p className="font-bold text-plum-950">{s.missingSkill}</p>
                  <p className="mt-1 text-plum-700">{s.projectIdea}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Job Detail & Apply Modal */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.job.title ?? 'Job Details'}
        description={detailTarget ? `${detailTarget.job.company} · ${detailTarget.job.location} · ${formatSalaryRangeInr(detailTarget.job.salaryMinInr, detailTarget.job.salaryMaxInr)}` : undefined}
        size="lg"
        footer={
          detailTarget && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDetailTarget(null)}>Close</Button>
              {!detailTarget.applicationStage && (
                <Button loading={applying} onClick={() => applyForJob(detailTarget.job.id)}>Submit Application</Button>
              )}
            </div>
          )
        }
      >
        {detailTarget && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-lavender-200 bg-ivory p-4">
              <div>
                <p className="text-xs font-semibold text-plum-700">Your Deterministic Match DNA</p>
                <p className="text-xs text-plum-600">{detailTarget.match.explanation.summary}</p>
              </div>
              <ScoreBadge score={detailTarget.match.overallScore} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#A8DFCA] bg-mint-100/45 p-3">
                <p className="text-xs font-bold text-mint-700">Matched Skills</p>
                <p className="mt-1 text-xs text-plum-900">{detailTarget.match.matchedSkills.join(', ') || 'None yet'}</p>
              </div>
              <div className="rounded-xl border border-[#F7BCAA] bg-peach-100/45 p-3">
                <p className="text-xs font-bold text-peach-700">Missing / Growth Skills</p>
                <p className="mt-1 text-xs text-plum-900">{detailTarget.match.missingSkills.join(', ') || 'None'}</p>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-6 text-plum-900">{detailTarget.job.description}</p>

            {!detailTarget.applicationStage && (
              <Field label="Optional note to recruiter">
                <textarea className={textareaClass} rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="Highlight a relevant project or availability…" />
              </Field>
            )}
          </div>
        )}
      </Modal>

      {/* Post-application Alternative Opportunities Modal when initial match is < 60% */}
      <Modal
        open={Boolean(altModal)}
        onClose={() => setAltModal(null)}
        title="Application Submitted — Explore Adjacent Opportunities Too!"
        description="While recruiters review your application, TalentIQ found other roles where your skills strongly align."
        size="lg"
      >
        {altModal && (
          <div className="space-y-3">
            {altModal.recommendations.length > 0 ? (
              altModal.recommendations.map((rec) => (
                <div key={rec.job.id} className="rounded-2xl border border-lavender-200 bg-ivory p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-plum-950">{rec.job.title}</p>
                      <p className="text-xs text-plum-600">{rec.job.company} · {rec.job.location}</p>
                    </div>
                    <ScoreBadge score={rec.matchScore} />
                  </div>
                  <p className="mt-1.5 text-xs text-plum-800">{rec.whyRecommended}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-lavender-200 bg-ivory p-4 text-xs text-plum-900">
                <Sparkles className="mb-1 h-4 w-4 text-accent" />
                Check Career Growth to close skill gaps for upcoming opportunities!
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
