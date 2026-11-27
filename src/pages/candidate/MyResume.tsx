import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, FileText, Plus, Save, Trash2, UploadCloud } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ui/Modal';
import { IntegrityRadarCard } from '../../components/IntegrityRadarCard';
import { SkillsInput } from '../../components/forms/SkillsInput';
import { Badge, Button, Card, Field, inputClass, textareaClass } from '../../components/ui/primitives';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime, formatFileSize } from '../../lib/utils';
import type { CertificationEntry, EducationEntry, ExperienceEntry, ProjectEntry } from '../../types';

export default function MyResume() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, loading, error, reload } = useApi(api.candidate.resume, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [expectedSalaryInr, setExpectedSalaryInr] = useState('');
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [certifications, setCertifications] = useState<CertificationEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replacePromptOpen, setReplacePromptOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data?.candidate) return;
    const c = data.candidate;
    setName(c.name || '');
    setPhone(c.phone || '');
    setLocation(c.location || '');
    setTitle(c.title || '');
    setYearsExperience(String(c.yearsExperience ?? 0));
    setExpectedSalaryInr(c.expectedSalaryInr ? String(c.expectedSalaryInr) : '');
    setSummary(c.summary || '');
    setSkills(c.skills || []);
    setEducation(c.education || []);
    setExperience(c.experience || []);
    setProjects(c.projects || []);
    setCertifications(c.certifications || []);
  }, [data]);

  const uploadFile = async (file: File, confirmReplace: boolean) => {
    setUploading(true);
    try {
      const res = await api.candidate.uploadResume(file, confirmReplace);
      toast.success('Resume parsed and profile updated!');
      if (res.warnings.length > 0) {
        toast.info(res.warnings[0], 'Parsing notes');
      }
      setReplacePromptOpen(false);
      setPendingFile(null);
      reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'REPLACE_CONFIRMATION_REQUIRED') {
        setPendingFile(file);
        setReplacePromptOpen(true);
      } else {
        toast.error(caught instanceof ApiError ? caught.message : 'Unable to upload resume.');
      }
    } finally {
      setUploading(false);
    }
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile(file, false);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.candidate.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        title: title.trim(),
        yearsExperience: Number(yearsExperience) || 0,
        expectedSalaryInr: expectedSalaryInr.trim() ? Number(expectedSalaryInr) : null,
        summary: summary.trim(),
        skills,
        education: education.filter((ed) => ed.degree.trim()),
        experience: experience.filter((ex) => ex.title.trim()),
        projects: projects.filter((p) => p.name.trim()),
        certifications: certifications.filter((c) => c.name.trim()),
      });
      toast.success('Profile details saved and Resume Integrity Radar refreshed.');
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingState label="Loading your resume & integrity report…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unable to load resume.'} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate Portal"
        title="My Resume & Integrity Radar"
        description="Upload your PDF or DOCX resume, review extracted details, fix any date inconsistencies, and keep your profile accurate."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={onFileSelect} />
            <Button icon={UploadCloud} loading={uploading} onClick={() => fileRef.current?.click()}>
              {data.resumes.length > 0 ? 'Replace Resume (PDF/DOCX)' : 'Upload Resume (PDF/DOCX)'}
            </Button>
          </>
        }
      />

      {data.resumes.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-bold text-plum-950">{data.resumes[0].originalName}</p>
                <p className="text-xs text-plum-600">{formatFileSize(data.resumes[0].fileSize)} · Uploaded {formatDateTime(data.resumes[0].createdAt)}</p>
              </div>
            </div>
            <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Parsed</Badge>
          </div>
        </Card>
      )}

      {/* Resume Integrity Radar */}
      <IntegrityRadarCard report={data.integrityReport} perspective="candidate" />

      {/* Editable Extracted Profile */}
      <form onSubmit={saveProfile}>
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-plum-950">Review & Correct Extracted Information</h2>
              <p className="text-xs text-plum-600">Indian formats supported (+91 phone, INR package, Indian cities & degrees).</p>
            </div>
            <Button type="submit" icon={Save} loading={saving}>Save Corrections</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name *"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Phone (+91)"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></Field>
            <Field label="City & State"><input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, Karnataka" /></Field>
            <Field label="Target / Current Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full Stack Developer" /></Field>
            <Field label="Experience (years)"><input type="number" min="0" max="50" step="0.5" className={inputClass} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} /></Field>
            <Field label="Expected Annual Package (INR ₹)" hint="e.g. 1000000 for ₹10 LPA">
              <input type="number" min="0" step="50000" className={inputClass} value={expectedSalaryInr} onChange={(e) => setExpectedSalaryInr(e.target.value)} placeholder="e.g. 1000000" />
            </Field>
          </div>

          <Field label="Professional Summary">
            <textarea className={textareaClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>

          <SkillsInput label="Skills" value={skills} onChange={setSkills} />

          {/* Experience Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-plum-950">Work Experience</h3>
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setExperience([...experience, { title: '', company: '', start: '', end: '', description: '' }])}>
                Add Role
              </Button>
            </div>
            <div className="space-y-3">
              {experience.map((exp, idx) => (
                <div key={idx} className="grid gap-3 rounded-xl border border-lavender-100 bg-ivory p-3 sm:grid-cols-2">
                  <input className={inputClass} value={exp.title} onChange={(e) => setExperience(experience.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} placeholder="Role title" />
                  <input className={inputClass} value={exp.company ?? ''} onChange={(e) => setExperience(experience.map((x, i) => (i === idx ? { ...x, company: e.target.value } : x)))} placeholder="Company" />
                  <div className="flex gap-2">
                    <input className={inputClass} value={exp.start ?? ''} onChange={(e) => setExperience(experience.map((x, i) => (i === idx ? { ...x, start: e.target.value } : x)))} placeholder="Start (e.g. Jan 2023)" />
                    <input className={inputClass} value={exp.end ?? ''} onChange={(e) => setExperience(experience.map((x, i) => (i === idx ? { ...x, end: e.target.value } : x)))} placeholder="End (e.g. Present)" />
                  </div>
                  <div className="flex gap-2">
                    <input className={inputClass} value={exp.description ?? ''} onChange={(e) => setExperience(experience.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} placeholder="Key responsibilities & outcomes" />
                    <Button size="icon" variant="danger" onClick={() => setExperience(experience.filter((_, i) => i !== idx))} aria-label="Remove role"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-plum-950">Education</h3>
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEducation([...education, { degree: '', field: '', institution: '', year: '' }])}>
                Add Education
              </Button>
            </div>
            <div className="space-y-3">
              {education.map((ed, idx) => (
                <div key={idx} className="grid gap-3 rounded-xl border border-lavender-100 bg-ivory p-3 sm:grid-cols-4">
                  <input className={inputClass} value={ed.degree} onChange={(e) => setEducation(education.map((x, i) => (i === idx ? { ...x, degree: e.target.value } : x)))} placeholder="Degree (B.Tech, MCA)" />
                  <input className={inputClass} value={ed.field ?? ''} onChange={(e) => setEducation(education.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))} placeholder="Field" />
                  <input className={inputClass} value={ed.institution ?? ''} onChange={(e) => setEducation(education.map((x, i) => (i === idx ? { ...x, institution: e.target.value } : x)))} placeholder="College / University" />
                  <div className="flex gap-2">
                    <input className={inputClass} value={ed.year ?? ''} onChange={(e) => setEducation(education.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x)))} placeholder="Year" />
                    <Button size="icon" variant="danger" onClick={() => setEducation(education.filter((_, i) => i !== idx))} aria-label="Remove education"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-lavender-100 pt-4">
            <Button type="submit" icon={Save} loading={saving}>Save & Re-run Integrity Radar</Button>
          </div>
        </Card>
      </form>

      <ConfirmDialog
        open={replacePromptOpen}
        onClose={() => { setReplacePromptOpen(false); setPendingFile(null); }}
        onConfirm={() => pendingFile && uploadFile(pendingFile, true)}
        loading={uploading}
        destructive={false}
        title="Replace your existing resume?"
        description={`Uploading "${pendingFile?.name ?? 'new file'}" will update your extracted resume text and profile fields. Confirm to continue.`}
        confirmLabel="Confirm & Replace"
      />
    </div>
  );
}
