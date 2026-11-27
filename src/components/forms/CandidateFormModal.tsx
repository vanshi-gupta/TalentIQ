import { useEffect, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, ChevronDown, GraduationCap, Plus, Trash2 } from 'lucide-react';
import type { Candidate, CandidateStage, EducationEntry, ExperienceEntry } from '../../types';
import { api, ApiError } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button, Field, inputClass, textareaClass } from '../ui/primitives';
import { SkillsInput } from './SkillsInput';
import { useToast } from '../../context/ToastContext';

const STAGES: { value: CandidateStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Not Selected' },
];

const emptyEducation: EducationEntry = { degree: '', field: '', institution: '', year: '' };
const emptyExperience: ExperienceEntry = { title: '', company: '', start: '', end: '', description: '' };

interface FormState {
  name: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  yearsExperience: string;
  stage: CandidateStage;
  summary: string;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
}

const blankState: FormState = {
  name: '',
  email: '',
  phone: '',
  location: '',
  title: '',
  yearsExperience: '',
  stage: 'new',
  summary: '',
  skills: [],
  education: [],
  experience: [],
};

export function CandidateFormModal({
  open,
  onClose,
  candidate,
  onSaved,
  defaultStage = 'new',
}: {
  open: boolean;
  onClose: () => void;
  candidate?: Candidate | null;
  onSaved: (candidate: Candidate) => void;
  defaultStage?: CandidateStage;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(blankState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowHistory(Boolean(candidate && (candidate.education.length > 0 || candidate.experience.length > 0)));
    if (candidate) {
      setForm({
        name: candidate.name,
        email: candidate.email ?? '',
        phone: candidate.phone ?? '',
        location: candidate.location ?? '',
        title: candidate.title ?? '',
        yearsExperience: String(candidate.yearsExperience || ''),
        stage: candidate.stage,
        summary: candidate.summary ?? '',
        skills: [...candidate.skills],
        education: candidate.education.map((entry) => ({ ...entry })),
        experience: candidate.experience.map((entry) => ({ ...entry })),
      });
    } else {
      setForm({ ...blankState, stage: defaultStage, skills: [], education: [], experience: [] });
    }
  }, [open, candidate, defaultStage]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateEducation = (index: number, key: keyof EducationEntry, value: string) => {
    setForm((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry),
    }));
  };

  const updateExperience = (index: number, key: keyof ExperienceEntry, value: string) => {
    setForm((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Candidate name is required.');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError('Enter a valid email address.');
    }
    const education = form.education.filter((entry) => entry.degree.trim());
    const experience = form.experience.filter((entry) => entry.title.trim());
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        title: form.title.trim(),
        yearsExperience: Number(form.yearsExperience) || 0,
        stage: form.stage,
        summary: form.summary.trim(),
        skills: form.skills,
        education,
        experience,
      };
      const saved = candidate ? await api.candidates.update(candidate.id, body) : await api.candidates.create(body);
      toast.success(candidate ? `${saved.name}'s profile was updated.` : `${saved.name} was added.`);
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const detail = caught.details?.map((item) => item.message).filter(Boolean).join(' ');
        setError(detail || caught.message);
      } else {
        setError('Unable to save the candidate. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={candidate ? 'Edit candidate' : 'Add candidate'}
      description={candidate ? 'Update verified details on this candidate profile.' : 'Add candidate details manually or upload a resume in Screening.'}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="candidate-form" loading={saving}>{candidate ? 'Save changes' : 'Add candidate'}</Button>
        </div>
      }
    >
      <form id="candidate-form" onSubmit={submit} className="space-y-6">
        {error && <div className="rounded-xl border border-[#F7BCAA] bg-peach-100 px-3.5 py-3 text-sm text-peach-700">{error}</div>}

        <section>
          <h3 className="mb-3 text-sm font-bold text-plum-950">Basic details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *"><input className={inputClass} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Ananya Sharma" autoFocus /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" /></Field>
            <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+91 98765 43210" /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Bengaluru, Karnataka" /></Field>
          </div>
        </section>

        <section className="border-t border-lavender-100 pt-5">
          <h3 className="mb-3 text-sm font-bold text-plum-950">Professional details</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current job title"><input className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Frontend Developer" /></Field>
            <Field label="Total experience (years)"><input type="number" min="0" max="60" step="0.5" className={inputClass} value={form.yearsExperience} onChange={(e) => setField('yearsExperience', e.target.value)} placeholder="e.g. 4" /></Field>
            <Field label="Stage"><select className={inputClass} value={form.stage} onChange={(e) => setField('stage', e.target.value as CandidateStage)}>{STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          </div>
          <div className="mt-4">
            <SkillsInput label="Skills" value={form.skills} onChange={(skills) => setField('skills', skills)} placeholder="React, SQL, Node.js…" />
          </div>
          <div className="mt-4">
            <Field label="Professional summary"><textarea className={textareaClass} rows={3} value={form.summary} onChange={(e) => setField('summary', e.target.value)} placeholder="A concise summary of experience and strengths…" /></Field>
          </div>
        </section>

        <div className="border-t border-lavender-100 pt-5">
          <button type="button" onClick={() => setShowHistory((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-bold text-plum-950">
            <span>Education & work history <span className="font-normal text-plum-600">(optional)</span></span>
            <ChevronDown className={`h-4 w-4 text-plum-600 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <div className="mt-4 space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-plum-900"><GraduationCap className="h-3.5 w-3.5 text-accent" />Education</p>
                  <button type="button" onClick={() => setField('education', [...form.education, { ...emptyEducation }])} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-deep"><Plus className="h-3 w-3" />Add education</button>
                </div>
                {form.education.length === 0 && <p className="rounded-xl border border-dashed border-lavender-200 px-3 py-3 text-xs text-plum-600">No education entries added yet.</p>}
                {form.education.map((entry, index) => (
                  <div key={index} className="mb-3 rounded-xl border border-lavender-100 bg-ivory p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className={inputClass} value={entry.degree} onChange={(e) => updateEducation(index, 'degree', e.target.value)} placeholder="Degree, e.g. B.Tech" />
                      <input className={inputClass} value={entry.field ?? ''} onChange={(e) => updateEducation(index, 'field', e.target.value)} placeholder="Field, e.g. Computer Science" />
                      <input className={inputClass} value={entry.institution ?? ''} onChange={(e) => updateEducation(index, 'institution', e.target.value)} placeholder="College or university" />
                      <div className="flex gap-2">
                        <input className={inputClass} value={entry.year ?? ''} onChange={(e) => updateEducation(index, 'year', e.target.value)} placeholder="Year, e.g. 2022" />
                        <button type="button" onClick={() => setField('education', form.education.filter((_, i) => i !== index))} className="shrink-0 rounded-xl border border-lavender-200 bg-white px-3 text-plum-600 transition hover:bg-peach-100 hover:text-peach-700" aria-label="Remove education"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-plum-900"><BriefcaseBusiness className="h-3.5 w-3.5 text-accent" />Work history</p>
                  <button type="button" onClick={() => setField('experience', [...form.experience, { ...emptyExperience }])} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-deep"><Plus className="h-3 w-3" />Add experience</button>
                </div>
                {form.experience.length === 0 && <p className="rounded-xl border border-dashed border-lavender-200 px-3 py-3 text-xs text-plum-600">No work history added yet.</p>}
                {form.experience.map((entry, index) => (
                  <div key={index} className="mb-3 rounded-xl border border-lavender-100 bg-ivory p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className={inputClass} value={entry.title} onChange={(e) => updateExperience(index, 'title', e.target.value)} placeholder="Job title" />
                      <input className={inputClass} value={entry.company ?? ''} onChange={(e) => updateExperience(index, 'company', e.target.value)} placeholder="Company name" />
                      <div className="flex gap-2">
                        <input className={inputClass} value={entry.start ?? ''} onChange={(e) => updateExperience(index, 'start', e.target.value)} placeholder="Start, e.g. Jan 2021" />
                        <input className={inputClass} value={entry.end ?? ''} onChange={(e) => updateExperience(index, 'end', e.target.value)} placeholder="End, e.g. Present" />
                      </div>
                      <div className="flex gap-2">
                        <textarea className={textareaClass} rows={1} value={entry.description ?? ''} onChange={(e) => updateExperience(index, 'description', e.target.value)} placeholder="Responsibilities & impact" />
                        <button type="button" onClick={() => setField('experience', form.experience.filter((_, i) => i !== index))} className="shrink-0 rounded-xl border border-lavender-200 bg-white px-3 text-plum-600 transition hover:bg-peach-100 hover:text-peach-700" aria-label="Remove work experience"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
