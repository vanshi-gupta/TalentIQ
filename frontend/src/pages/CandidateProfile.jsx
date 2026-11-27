import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  Loader2,
  Save,
  Pencil,
  X,
  Lightbulb,
  Mail,
  Phone,
  MapPin,
  Link2,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileText,
  ArrowRight,
  Layers,
  Trophy,
} from 'lucide-react'
import { api } from '../api.js'
import { Spinner, ErrorBox, Empty, Notice } from '../components/ui.jsx'
import TagInput from '../components/TagInput.jsx'

const EDU = [
  [0, 'Not specified'],
  [1, 'High School'],
  [2, 'Diploma'],
  [3, "Bachelor's"],
  [4, "Master's"],
  [5, 'PhD'],
]

const SEVERITY_META = {
  high: {
    label: 'Structural / High',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    card: 'border-rose-200 bg-rose-50/40',
    icon: AlertTriangle,
    iconColor: 'text-rose-600',
  },
  medium: {
    label: 'Recommended',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    card: 'border-amber-200 bg-amber-50/40',
    icon: Lightbulb,
    iconColor: 'text-amber-600',
  },
  low: {
    label: 'Polish',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    card: 'border-indigo-200 bg-indigo-50/35',
    icon: Info,
    iconColor: 'text-indigo-600',
  },
  info: {
    label: 'Target Tip',
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
    card: 'border-teal-200 bg-teal-50/35',
    icon: Sparkles,
    iconColor: 'text-teal-600',
  },
}

function initialsFor(name) {
  const parts = (name || 'Candidate').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'TQ'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function deriveStrengths(p) {
  const strengths = []
  if ((p.technical_skills || []).length >= 5) {
    strengths.push(`${p.technical_skills.length} technical skills clearly detected across your resume.`)
  }
  if ((p.experience_years || 0) > 0) {
    strengths.push(`${p.experience_years} year${p.experience_years === 1 ? '' : 's'} of structured work experience identified.`)
  }
  const bullets = (p.experience || []).flatMap((e) => e.bullets || [])
  const quantified = bullets.filter((b) => /\d/.test(b))
  if (quantified.length > 0) {
    strengths.push(`${quantified.length} experience bullet${quantified.length === 1 ? '' : 's'} include measurable metrics or numbers.`)
  }
  if ((p.projects || []).length > 0) {
    strengths.push(`${p.projects.length} hands-on project${p.projects.length === 1 ? '' : 's'} documented with implementation details.`)
  }
  if ((p.certifications || []).length > 0) {
    strengths.push(`${p.certifications.length} certification${p.certifications.length === 1 ? '' : 's'} / verified credential${p.certifications.length === 1 ? '' : 's'} listed.`)
  }
  if (p.highest_education && p.highest_education !== 'Not specified') {
    strengths.push(`Education verified at ${p.highest_education} level.`)
  }
  return strengths
}

function EditForm({ profile, onSave, onCancel, busy }) {
  const [f, setF] = useState({
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    summary: profile.summary || '',
    technical_skills: profile.technical_skills || [],
    soft_skills: profile.soft_skills || [],
    experience_years: profile.experience_years ?? 0,
    highest_education_level: profile.highest_education_level ?? 0,
    certifications: profile.certifications || [],
  })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          ...f,
          experience_years: Number(f.experience_years) || 0,
          highest_education_level: Number(f.highest_education_level),
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['name', 'Name', 'Full name'],
          ['email', 'Email', 'name@example.com'],
          ['phone', 'Phone', '+91 98765 43210'],
          ['location', 'Location', 'City, Country'],
        ].map(([k, l, ph]) => (
          <div key={k}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
              {l}
            </label>
            <input
              className="input"
              value={f[k]}
              placeholder={ph}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
          Professional summary
        </label>
        <textarea
          className="input min-h-[96px] leading-relaxed"
          value={f.summary}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="Concise 2–3 line overview of your experience and core strengths…"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Technical skills
          </label>
          <TagInput value={f.technical_skills} onChange={(v) => set('technical_skills', v)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Soft skills
          </label>
          <TagInput tone="purple" value={f.soft_skills} onChange={(v) => set('soft_skills', v)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Years of experience
          </label>
          <input
            type="number"
            min="0"
            max="60"
            step="0.5"
            className="input"
            value={f.experience_years}
            onChange={(e) => set('experience_years', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Highest education
          </label>
          <select
            className="input"
            value={f.highest_education_level}
            onChange={(e) => set('highest_education_level', e.target.value)}
          >
            {EDU.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
          Certifications
        </label>
        <TagInput
          value={f.certifications}
          onChange={(v) => set('certifications', v)}
          placeholder="Add a certification and press Enter"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-indigo-100 pt-4">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          <X className="h-4 w-4" /> Cancel
        </button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </button>
      </div>
    </form>
  )
}

export default function CandidateProfile() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef()

  useEffect(() => {
    api.myProfile().then(setData).catch((e) => setError(e.message))
  }, [])

  const upload = async (file) => {
    if (!file) return
    setBusy('upload')
    setError('')
    setMsg('')
    try {
      setData(await api.uploadMyResume(file))
      setMsg('Resume processed. Review the extracted details below and edit anything if needed.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const save = async (body) => {
    setBusy('save')
    setError('')
    try {
      setData(await api.saveProfile(body))
      setEditing(false)
      setMsg('Profile updated. Job matches now reflect your corrected details.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const p = data?.profile
  const strengths = useMemo(() => (p ? deriveStrengths(p) : []), [p])
  const improvements = data?.improvements || []
  const highCount = improvements.filter((x) => x.severity === 'high').length
  const mediumCount = improvements.filter((x) => x.severity === 'medium').length

  if (!data) return error ? <ErrorBox error={error} /> : <Spinner label="Loading your career profile…" />

  const headline = p?.experience?.[0]?.title || (p?.highest_education && p.highest_education !== 'Not specified' ? `${p.highest_education} Graduate` : null)
  const techSkills = p?.technical_skills || []
  const softSkills = p?.soft_skills || []
  const educationList = p?.education || []
  const experienceList = p?.experience || []
  const projectList = p?.projects || []
  const certList = p?.certifications || []
  const achievementList = p?.achievements || []

  return (
    <div className="space-y-6">
      {/* Polished Top Header */}
      <div className="flex flex-col gap-4 border-b border-indigo-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> Candidate Career Intelligence
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#172554] sm:text-3xl">
            My Profile & Resume Insights
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Upload your resume, inspect structured skills and experience, and refine insights used for job matching.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {p && !editing && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit profile
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={busy === 'upload'}
            onClick={() => input.current.click()}
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {p ? 'Replace resume' : 'Upload resume'}
          </button>
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx"
            hidden
            onChange={(e) => {
              upload(e.target.files[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {(error || msg) && (
        <div className="space-y-2">
          <ErrorBox error={error} />
          {msg && <Notice>{msg}</Notice>}
        </div>
      )}

      {!p ? (
        <Empty
          title="No resume uploaded yet"
          hint="Upload a PDF or DOCX resume (max 5 MB) to unlock your structured profile, AI resume insights, and matched jobs."
          action={
            <button type="button" className="btn-primary mt-2" onClick={() => input.current.click()}>
              <UploadCloud className="h-4 w-4" /> Upload resume
            </button>
          }
        />
      ) : (
        <>
          {/* Hero Profile Identity Card */}
          <div className="rounded-2xl border border-indigo-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-sm">
                  {initialsFor(p.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-[#172554] sm:text-2xl">
                      {p.name || 'Name not detected'}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-[#F5F3FF] px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      <FileText className="h-3 w-3" /> {data.filename}
                    </span>
                  </div>
                  {headline && (
                    <p className="mt-1 text-sm font-medium text-indigo-700">{headline}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#475569]">
                    {p.email && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2.5 py-1 border border-slate-200/80 text-[#1E293B]">
                        <Mail className="h-3.5 w-3.5 text-indigo-600" /> {p.email}
                      </span>
                    )}
                    {p.phone && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2.5 py-1 border border-slate-200/80 text-[#1E293B]">
                        <Phone className="h-3.5 w-3.5 text-indigo-600" /> {p.phone}
                      </span>
                    )}
                    {p.location && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2.5 py-1 border border-slate-200/80 text-[#1E293B]">
                        <MapPin className="h-3.5 w-3.5 text-indigo-600" /> {p.location}
                      </span>
                    )}
                    {(p.links || []).map((lnk) => (
                      <span
                        key={lnk}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2.5 py-1 border border-slate-200/80 text-indigo-700"
                      >
                        <Link2 className="h-3.5 w-3.5" /> {lnk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                <Link to="/candidate/jobs" className="btn-ghost">
                  View Job Matches <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Factual Profile Metrics Strip */}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-indigo-100 pt-5 sm:grid-cols-4">
              <div className="rounded-xl border border-indigo-100 bg-[#F5F3FF]/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
                  <span>Experience</span>
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-1 text-lg font-bold text-[#172554]">{p.experience_years ?? 0} yrs</div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-[#F5F3FF]/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
                  <span>Education</span>
                  <GraduationCap className="h-4 w-4 text-violet-600" />
                </div>
                <div className="mt-1 truncate text-lg font-bold text-[#172554]">{p.highest_education || 'Not specified'}</div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-[#F5F3FF]/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
                  <span>Verified Skills</span>
                  <Layers className="h-4 w-4 text-teal-600" />
                </div>
                <div className="mt-1 text-lg font-bold text-[#172554]">
                  {techSkills.length + softSkills.length}{' '}
                  <span className="text-xs font-normal text-[#475569]">({techSkills.length} tech)</span>
                </div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-[#F5F3FF]/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
                  <span>Projects & Certs</span>
                  <FolderGit2 className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-1 text-lg font-bold text-[#172554]">
                  {projectList.length} proj · {certList.length} cert
                </div>
              </div>
            </div>
          </div>

          {/* Main Dashboard Two-Column Content */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 8 Columns: Structured Profile or Edit Form */}
            <div className="space-y-6 lg:col-span-8">
              {editing ? (
                <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#172554]">Edit Parsed Profile</h3>
                      <p className="text-xs text-[#475569]">
                        Correct any extracted details. Job match scores immediately update on save.
                      </p>
                    </div>
                  </div>
                  <EditForm
                    profile={p}
                    busy={busy === 'save'}
                    onSave={save}
                    onCancel={() => setEditing(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Professional Summary */}
                  <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-base font-bold text-[#172554]">Professional Summary</h3>
                      <span className="text-xs text-[#64748B]">Parser: {data.parser?.entity_extraction || 'Active'}</span>
                    </div>
                    {p.summary ? (
                      <p className="text-sm leading-6 text-[#334155]">{p.summary}</p>
                    ) : (
                      <p className="text-sm italic text-[#64748B]">
                        No summary section detected. Click “Edit profile” to add a 2–3 line career overview.
                      </p>
                    )}
                  </div>

                  {/* Categorized Skills Card */}
                  <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#172554]">Skills & Competencies</h3>
                        <p className="text-xs text-[#64748B]">Extracted directly from your resume sections and project evidence.</p>
                      </div>
                      <button type="button" className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setEditing(true)}>
                        Edit skills
                      </button>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="rounded-xl border border-indigo-100 bg-[#F8FAFC] p-4">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#172554]">Technical Skills</span>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            {techSkills.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {techSkills.length ? (
                            techSkills.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs italic text-[#64748B]">None detected</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-teal-100 bg-[#F0FDFA]/60 p-4">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#172554]">Soft Skills</span>
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                            {softSkills.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {softSkills.length ? (
                            softSkills.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs italic text-[#64748B]">None detected</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Experience Timeline */}
                  <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-base font-bold text-[#172554]">Work Experience</h3>
                      </div>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        {p.experience_years ?? 0} yrs detected
                      </span>
                    </div>

                    {experienceList.length ? (
                      <div className="relative space-y-5 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-0.5 before:bg-indigo-100">
                        {experienceList.map((exp, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-white" />
                            <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFC]/70 p-4">
                              <h4 className="text-sm font-bold text-[#172554]">{exp.title}</h4>
                              {(exp.bullets || []).length > 0 && (
                                <ul className="mt-2 space-y-1.5 text-sm text-[#334155]">
                                  {exp.bullets.map((b, j) => (
                                    <li key={j} className="flex items-start gap-2">
                                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-[#64748B]">No work experience entries detected in this resume.</p>
                    )}
                  </div>

                  {/* Projects + Education + Credentials */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <FolderGit2 className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-base font-bold text-[#172554]">Projects</h3>
                      </div>
                      {projectList.length ? (
                        <div className="space-y-3">
                          {projectList.map((proj, i) => (
                            <div key={i} className="rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-3.5">
                              <div className="text-sm font-bold text-[#172554]">{proj.name}</div>
                              {proj.description && (
                                <p className="mt-1 text-xs leading-5 text-[#475569]">{proj.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-[#64748B]">No projects detected.</p>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-violet-600" />
                            <h3 className="text-base font-bold text-[#172554]">Education</h3>
                          </div>
                          <span className="text-xs font-semibold text-violet-700">{p.highest_education}</span>
                        </div>
                        {educationList.length ? (
                          <div className="space-y-2.5">
                            {educationList.map((edu, i) => (
                              <div key={i} className="rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-medium text-[#1E293B]">
                                {edu.degree}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-[#64748B]">No education section detected.</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                          <Award className="h-4 w-4 text-teal-600" />
                          <h3 className="text-base font-bold text-[#172554]">Certifications & Achievements</h3>
                        </div>
                        {certList.length || achievementList.length ? (
                          <div className="space-y-2">
                            {certList.map((c, i) => (
                              <div key={`c-${i}`} className="flex items-start gap-2 text-xs text-[#1E293B]">
                                <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                <span>{c}</span>
                              </div>
                            ))}
                            {achievementList.map((a, i) => (
                              <div key={`a-${i}`} className="flex items-start gap-2 text-xs text-[#1E293B]">
                                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-[#64748B]">None detected yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right 4 Columns: AI Resume Insights & Recommendations */}
            <div className="space-y-6 lg:col-span-4">
              {/* Detected Resume Strengths */}
              {strengths.length > 0 && (
                <div className="rounded-2xl border border-teal-200/80 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal-50 text-teal-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#172554]">Resume Strengths</h3>
                      <p className="text-[11px] text-[#64748B]">Verified signals found in your profile</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5">
                    {strengths.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/40 p-2.5 text-xs leading-5 text-[#1E293B]">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Resume Improvement Assistant */}
              <div className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Lightbulb className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#172554]">AI Resume Insights</h3>
                      <p className="text-[11px] text-[#64748B]">Actionable quality & structure checks</p>
                    </div>
                  </div>
                </div>

                {/* Insight Summary Counters */}
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-2 py-2">
                    <div className="text-sm font-bold text-[#172554]">{improvements.length}</div>
                    <div className="text-[10px] font-medium text-[#64748B]">Total checks</div>
                  </div>
                  <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 px-2 py-2">
                    <div className="text-sm font-bold text-rose-700">{highCount}</div>
                    <div className="text-[10px] font-medium text-rose-700">Structural</div>
                  </div>
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-2 py-2">
                    <div className="text-sm font-bold text-amber-800">{mediumCount}</div>
                    <div className="text-[10px] font-medium text-amber-800">Suggested</div>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {improvements.map((s, i) => {
                    const meta = SEVERITY_META[s.severity] || SEVERITY_META.info
                    const Icon = meta.icon
                    return (
                      <li key={i} className={`rounded-xl border p-3 text-xs leading-5 ${meta.card}`}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                            <Icon className={`h-3 w-3 ${meta.iconColor}`} />
                            {meta.label}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wide text-[#475569]">
                            {s.area}
                          </span>
                        </div>
                        <p className="text-[#1E293B]">{s.message}</p>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Next Step Callout */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-[#F5F3FF] to-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-[#172554]">Ready to see where you rank?</h3>
                <p className="mt-1 text-xs leading-5 text-[#475569]">
                  Explore active openings scored against your skills, experience, and education with transparent skill-gap coaching.
                </p>
                <Link to="/candidate/jobs" className="btn-primary mt-4 w-full">
                  Explore Job Matches <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
