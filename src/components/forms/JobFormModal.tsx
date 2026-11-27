import { useEffect, useState, type FormEvent } from 'react';
import type { Job, JobStatus } from '../../types';
import { api, ApiError } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button, Field, inputClass, textareaClass } from '../ui/primitives';
import { SkillsInput } from './SkillsInput';
import { useToast } from '../../context/ToastContext';

interface FormState {
  title: string;
  company: string;
  department: string;
  location: string;
  workMode: 'On-site' | 'Hybrid' | 'Remote';
  employmentType: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: string;
  maxExperience: string;
  salaryMinInr: string;
  salaryMaxInr: string;
  educationRequirement: string;
  status: JobStatus;
}

const blank: FormState = {
  title: '',
  company: 'TalentIQ Partner',
  department: '',
  location: '',
  workMode: 'Hybrid',
  employmentType: 'Full-time',
  description: '',
  requiredSkills: [],
  preferredSkills: [],
  minExperience: '',
  maxExperience: '',
  salaryMinInr: '',
  salaryMaxInr: '',
  educationRequirement: '',
  status: 'active',
};

export function JobFormModal({
  open,
  onClose,
  job,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  job?: Job | null;
  onSaved: (job: Job) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (job) {
      setForm({
        title: job.title,
        company: job.company ?? 'TalentIQ Partner',
        department: job.department,
        location: job.location,
        workMode: (job.workMode as FormState['workMode']) || 'On-site',
        employmentType: job.employmentType || 'Full-time',
        description: job.description,
        requiredSkills: [...job.requiredSkills],
        preferredSkills: [...job.preferredSkills],
        minExperience: String(job.minExperience || ''),
        maxExperience: String(job.maxExperience || ''),
        salaryMinInr: job.salaryMinInr ? String(job.salaryMinInr) : '',
        salaryMaxInr: job.salaryMaxInr ? String(job.salaryMaxInr) : '',
        educationRequirement: job.educationRequirement,
        status: job.status,
      });
    } else {
      setForm({ ...blank, requiredSkills: [], preferredSkills: [] });
    }
  }, [open, job]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Job title is required.');
    if (form.description.trim().length < 30) return setError('Add a job description of at least 30 characters.');
    if (form.requiredSkills.length === 0) return setError('Add at least one required skill.');
    const minExperience = Number(form.minExperience) || 0;
    const maxExperience = Number(form.maxExperience) || 0;
    if (maxExperience > 0 && maxExperience < minExperience) {
      return setError('Maximum experience cannot be less than minimum experience.');
    }
    const salaryMinInr = form.salaryMinInr.trim() ? Number(form.salaryMinInr) : null;
    const salaryMaxInr = form.salaryMaxInr.trim() ? Number(form.salaryMaxInr) : null;
    if (salaryMinInr !== null && salaryMaxInr !== null && salaryMaxInr > 0 && salaryMaxInr < salaryMinInr) {
      return setError('Maximum INR salary cannot be less than minimum INR salary.');
    }

    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        company: form.company.trim() || 'TalentIQ Partner',
        department: form.department.trim(),
        location: form.location.trim(),
        workMode: form.workMode,
        employmentType: form.employmentType,
        description: form.description.trim(),
        requiredSkills: form.requiredSkills,
        preferredSkills: form.preferredSkills,
        minExperience,
        maxExperience,
        salaryMinInr,
        salaryMaxInr,
        educationRequirement: form.educationRequirement.trim(),
        status: form.status,
      };
      const saved = job ? await api.jobs.update(job.id, body) : await api.jobs.create(body);
      toast.success(job ? `${saved.title} was updated.` : `${saved.title} was created.`);
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.details?.map((item) => item.message).join(' ') || caught.message);
      } else {
        setError('Unable to save this job. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={job ? 'Edit job opening' : 'Create new job opening'}
      description="Define clear requirements and INR compensation so candidates and deterministic matching stay transparent."
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="job-form" loading={saving}>{job ? 'Save changes' : 'Publish / Save job'}</Button>
        </div>
      }
    >
      <form id="job-form" onSubmit={submit} className="space-y-5">
        {error && <div className="rounded-xl border border-[#F7BCAA] bg-peach-100 px-3.5 py-3 text-sm text-peach-700">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title *"><input className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Full Stack Developer" autoFocus /></Field>
          <Field label="Company / Hiring Team"><input className={inputClass} value={form.company} onChange={(e) => setField('company', e.target.value)} placeholder="e.g. PixelCraft India" /></Field>
          <Field label="Department"><input className={inputClass} value={form.department} onChange={(e) => setField('department', e.target.value)} placeholder="e.g. Engineering" /></Field>
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="e.g. Bengaluru, Karnataka" /></Field>
          <Field label="Work mode">
            <select className={inputClass} value={form.workMode} onChange={(e) => setField('workMode', e.target.value as FormState['workMode'])}>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
            </select>
          </Field>
          <Field label="Employment type">
            <select className={inputClass} value={form.employmentType} onChange={(e) => setField('employmentType', e.target.value)}>
              <option value="Full-time">Full-time</option>
              <option value="Internship">Internship</option>
              <option value="Contract">Contract</option>
              <option value="Part-time">Part-time</option>
            </select>
          </Field>
          <Field label="Minimum experience (years)"><input type="number" min="0" max="50" step="0.5" className={inputClass} value={form.minExperience} onChange={(e) => setField('minExperience', e.target.value)} placeholder="e.g. 2" /></Field>
          <Field label="Maximum experience (years)"><input type="number" min="0" max="50" step="0.5" className={inputClass} value={form.maxExperience} onChange={(e) => setField('maxExperience', e.target.value)} placeholder="e.g. 5" /></Field>
          <Field label="Min annual salary (INR ₹)" hint="e.g. 800000 for ₹8 LPA"><input type="number" min="0" step="50000" className={inputClass} value={form.salaryMinInr} onChange={(e) => setField('salaryMinInr', e.target.value)} placeholder="e.g. 800000" /></Field>
          <Field label="Max annual salary (INR ₹)" hint="e.g. 1400000 for ₹14 LPA"><input type="number" min="0" step="50000" className={inputClass} value={form.salaryMaxInr} onChange={(e) => setField('salaryMaxInr', e.target.value)} placeholder="e.g. 1400000" /></Field>
          <Field label="Education requirement"><input className={inputClass} value={form.educationRequirement} onChange={(e) => setField('educationRequirement', e.target.value)} placeholder="e.g. B.Tech / BCA / MCA" /></Field>
          <Field label="Job status">
            <select className={inputClass} value={form.status} onChange={(e) => setField('status', e.target.value as JobStatus)}>
              <option value="active">Active — published & open</option>
              <option value="draft">Draft — internal review</option>
              <option value="paused">Paused — temporarily on hold</option>
              <option value="closed">Closed — no longer hiring</option>
            </select>
          </Field>
        </div>

        <Field label="Job description *" hint="Minimum 30 characters. Used for keyword relevance and AI summaries.">
          <textarea className={textareaClass} rows={5} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Describe responsibilities, tech stack, and collaboration expectations…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <SkillsInput label="Required skills *" value={form.requiredSkills} onChange={(skills) => setField('requiredSkills', skills)} hint="Core must-have qualifications." />
          <SkillsInput label="Preferred skills" value={form.preferredSkills} onChange={(skills) => setField('preferredSkills', skills)} hint="Good-to-have skills." />
        </div>
      </form>
    </Modal>
  );
}
