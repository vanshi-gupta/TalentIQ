import { useEffect, useRef, useState } from 'react'
import { UploadCloud, Trash2, Mail, Phone, GraduationCap, Award, FolderGit2, Loader2, CheckCircle2, XCircle, EyeOff, Download } from 'lucide-react'
import { api, download, getToken } from '../api.js'
import { PageHeader, Spinner, ErrorBox, Empty, Chip, Modal, Notice } from '../components/ui.jsx'

export function ProfileDetails({ p }) {
  return (
    <div className="space-y-4 text-sm">
      {p.summary && <p className="text-slate-300">{p.summary}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Technical skills">{p.technical_skills.length ? p.technical_skills.map((s) => <Chip key={s} tone="blue">{s}</Chip>) : <Muted>None detected</Muted>}</Section>
        <Section title="Soft skills">{p.soft_skills.length ? p.soft_skills.map((s) => <Chip key={s} tone="purple">{s}</Chip>) : <Muted>None detected</Muted>}</Section>
      </div>
      <Section title={`Education (${p.highest_education})`} col>{p.education.length ? p.education.map((e, i) => <div key={i} className="text-slate-300">{e.degree}</div>) : <Muted>No education section detected</Muted>}</Section>
      <Section title={`Experience (${p.experience_years} yrs detected)`} col>{p.experience.length ? p.experience.map((e, i) => (
        <div key={i}><div className="font-medium text-slate-200">{e.title}</div>{e.bullets.slice(0, 3).map((b, j) => <div key={j} className="pl-3 text-slate-400">• {b}</div>)}</div>)) : <Muted>No work experience detected</Muted>}</Section>
      <Section title="Projects" col>{p.projects.length ? p.projects.map((x, i) => <div key={i}><span className="font-medium text-slate-200">{x.name}</span><div className="text-slate-400">{x.description}</div></div>) : <Muted>No projects detected</Muted>}</Section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Certifications" col>{p.certifications.length ? p.certifications.map((c, i) => <div key={i} className="text-slate-300">{c}</div>) : <Muted>None detected</Muted>}</Section>
        <Section title="Achievements" col>{p.achievements.length ? p.achievements.map((c, i) => <div key={i} className="text-slate-300">{c}</div>) : <Muted>None detected</Muted>}</Section>
      </div>
    </div>
  )
}
const Muted = ({ children }) => <span className="text-xs italic text-slate-500">{children}</span>
const Section = ({ title, children, col }) => (
  <div><div className="label">{title}</div><div className={col ? 'space-y-1.5' : 'flex flex-wrap gap-1.5'}>{children}</div></div>)

export default function Resumes() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState(null)
  const [drag, setDrag] = useState(false)
  const [view, setView] = useState(null)
  const input = useRef()
  const load = () => api.resumes().then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const upload = async (fileList) => {
    const files = [...fileList]
    if (!files.length) return
    setUploading(true); setError(''); setResults(null)
    try { setResults(await api.uploadResumes(files)); await load() } catch (e) { setError(e.message) } finally { setUploading(false) }
  }
  const remove = async (r) => {
    if (!confirm('Delete this resume and its screening results?')) return
    try { await api.deleteResume(r.resume_id); load() } catch (e) { setError(e.message) }
  }
  const openFile = async (r) => {
    try {
      const { blob, filename } = await api.downloadResumeFile(r.resume_id, r.filename)
      download(blob, filename)
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Resumes" subtitle="Upload PDF or DOCX resumes. Each is parsed, profiled and screened against all your jobs." />
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }}
        className={`card flex cursor-pointer flex-col items-center gap-2 border-dashed py-10 text-center transition ${drag ? 'border-brand-blue bg-brand-blue/10' : ''}`}
        onClick={() => !uploading && input.current.click()}>
        {uploading ? <><Loader2 className="h-8 w-8 animate-spin text-brand-blue" /><div className="font-semibold text-white">Extracting text, running NLP and scoring…</div></> :
          <><UploadCloud className="h-8 w-8 text-brand-blue" /><div className="font-semibold text-white">Drop resumes here or click to browse</div>
            <div className="text-xs text-slate-400">PDF or DOCX · up to 5 MB each · multiple files supported</div></>}
        <input ref={input} type="file" multiple accept=".pdf,.docx" hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      </div>
      <div className="mt-3 space-y-2"><ErrorBox error={error} />
        {results && (<div className="card !p-3 text-sm">
          <div className="mb-2 font-semibold text-white">{results.processed} processed, {results.failed} failed</div>
          {results.results.map((r, i) => <div key={i} className="flex items-center gap-2 py-0.5">
            {r.status === 'processed' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
            <span className="text-slate-300">{r.filename}</span>
            <span className="text-xs text-slate-500">{r.status === 'processed' ? `${r.skills_found} technical skills found` : r.error}</span></div>)}</div>)}
        {data?.blind_mode && <Notice><b>Blind screening is on.</b> Names, contact details and original files are hidden.</Notice>}</div>

      <div className="mt-6">
        {!data ? <Spinner /> : data.resumes.length === 0 ? <Empty title="No resumes yet" hint="Upload some resumes above to begin screening." /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.resumes.map((r) => (
              <div key={r.resume_id} className="card animate-fadeUp flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="flex items-center gap-1.5 truncate text-lg font-semibold text-white">{r.blind && <EyeOff className="h-4 w-4 text-violet-300" />}{r.name}</div>
                    <div className="truncate text-xs text-slate-500">{r.filename}</div></div>
                  <button className="btn-danger !p-2" onClick={() => remove(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  {r.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{r.email}</div>}
                  {r.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{r.phone}</div>}
                  <div className="flex items-center gap-1.5"><GraduationCap className="h-3 w-3" />{r.highest_education} · {r.experience_years} yrs experience</div>
                  <div className="flex items-center gap-1.5"><FolderGit2 className="h-3 w-3" />{r.projects.length} projects</div>
                  <div className="flex items-center gap-1.5"><Award className="h-3 w-3" />{r.certifications.length} certifications</div></div>
                <div className="mt-3 flex flex-wrap gap-1">{r.technical_skills.slice(0, 8).map((s) => <Chip key={s} tone="blue">{s}</Chip>)}
                  {r.technical_skills.length > 8 && <Chip>+{r.technical_skills.length - 8}</Chip>}
                  {r.technical_skills.length === 0 && <span className="text-xs text-amber-300">No technical skills detected</span>}</div>
                <div className="mt-auto flex gap-2 pt-4"><button className="btn-ghost flex-1" onClick={() => setView(r)}>Full profile</button>
                  {!r.blind && <button className="btn-ghost" onClick={() => openFile(r)} aria-label="Download original"><Download className="h-4 w-4" /></button>}</div>
              </div>))}
          </div>)}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name} wide>{view && <ProfileDetails p={view} />}</Modal>
    </div>
  )
}
