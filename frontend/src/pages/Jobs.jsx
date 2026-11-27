import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wand2, Pencil, Trash2, Loader2, MapPin, Clock } from 'lucide-react'
import { api } from '../api.js'
import { PageHeader, Modal, Spinner, ErrorBox, Empty, Chip, Notice } from '../components/ui.jsx'
import TagInput from '../components/TagInput.jsx'

const EDU = [[0, 'Not specified'], [2, "Diploma"], [3, "Bachelor's"], [4, "Master's"], [5, 'PhD']]
const BLANK = { title: '', description: '', required_skills: [], preferred_skills: [], min_experience: 0, education_level: 0, location: '', employment_type: 'Full-time' }

function JobForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState(initial || BLANK)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const extract = async () => {
    setBusy('extract'); setError(''); setNote('')
    try {
      const r = await api.extractJob({ title: f.title, description: f.description })
      setF((p) => ({ ...p, required_skills: r.required_skills, preferred_skills: r.preferred_skills, min_experience: r.min_experience, education_level: r.education_level }))
      setNote(`NLP found ${r.required_skills.length} required and ${r.preferred_skills.length} preferred skills, ${r.min_experience} yrs experience, education: ${r.education}. Review and edit below.`)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const save = async (e) => {
    e.preventDefault(); setBusy('save'); setError('')
    try {
      const body = { ...f, min_experience: Number(f.min_experience) || 0, education_level: Number(f.education_level) }
      initial?.id ? await api.updateJob(initial.id, body) : await api.createJob(body)
      onSaved()
    } catch (e2) { setError(e2.message) } finally { setBusy('') }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Job title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required /></div>
        <div><label className="label">Location</label><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Remote, Bengaluru…" /></div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between"><label className="label !mb-0">Description</label>
          <button type="button" className="btn-ghost !py-1 text-xs" onClick={extract} disabled={busy === 'extract' || f.description.length < 30}>
            {busy === 'extract' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Extract requirements with NLP</button></div>
        <textarea className="input min-h-[160px]" value={f.description} onChange={(e) => set('description', e.target.value)} required
          placeholder={'Requirements:\n- 3+ years of Python and SQL\n\nNice to have:\n- Docker'} />
      </div>
      {note && <Notice>{note}</Notice>}
      <div><label className="label">Required skills</label><TagInput value={f.required_skills} onChange={(v) => set('required_skills', v)} placeholder="Python, SQL…" /></div>
      <div><label className="label">Preferred skills</label><TagInput tone="purple" value={f.preferred_skills} onChange={(v) => set('preferred_skills', v)} placeholder="Docker, AWS…" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Min. experience (yrs)</label><input type="number" min="0" max="40" step="0.5" className="input" value={f.min_experience} onChange={(e) => set('min_experience', e.target.value)} /></div>
        <div><label className="label">Education</label><select className="input" value={f.education_level} onChange={(e) => set('education_level', e.target.value)}>
          {EDU.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label">Employment type</label><select className="input" value={f.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
          {['Full-time', 'Part-time', 'Contract', 'Internship'].map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy === 'save'}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} {initial?.id ? 'Save & re-rank' : 'Post job & screen candidates'}</button></div>
    </form>
  )
}

export default function Jobs() {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | job
  const load = () => api.jobs().then(setJobs).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])
  const remove = async (j) => {
    if (!confirm(`Delete "${j.title}" and its screening results?`)) return
    try { await api.deleteJob(j.id); load() } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Job Postings" subtitle="Requirements are extracted from the description with NLP, and you can refine them.">
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New job</button>
      </PageHeader>
      <ErrorBox error={error} />
      {!jobs ? <Spinner /> : jobs.length === 0 ? <Empty title="No jobs yet" hint="Create a job to start matching candidates." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((j) => (
            <div key={j.id} className="card animate-fadeUp">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="text-lg font-semibold text-white">{j.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    {j.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{j.employment_type}</span>
                    <span>{j.min_experience}+ yrs</span><span>{j.education}</span></div></div>
                <div className="flex gap-1">
                  <button className="btn-ghost !p-2" onClick={() => setEditing(j)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button className="btn-danger !p-2" onClick={() => remove(j)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {j.required_skills.map((s) => <Chip key={s} tone="blue">{s}</Chip>)}
                {j.preferred_skills.map((s) => <Chip key={s} tone="purple">{s}</Chip>)}
                {!j.required_skills.length && !j.preferred_skills.length && <span className="text-xs text-amber-300">No skills detected. Edit the job to add some.</span>}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-400">{j.candidates_screened} screened{j.top_score != null && <> · top {j.top_score}%</>}</span>
                <Link to={`/recruiter/matching?job=${j.id}`} className="font-semibold text-brand-blue hover:underline">View ranking →</Link></div>
            </div>))}
        </div>)}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit job' : 'New job posting'} wide>
        {editing && <JobForm initial={editing === 'new' ? null : { ...editing }} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      </Modal>
    </div>
  )
}
