import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileText, Filter, GitCompare, EyeOff, Loader2, MessageSquareText, ThumbsUp, AlertTriangle, Lightbulb, Medal } from 'lucide-react'
import { api, download } from '../api.js'
import { PageHeader, Spinner, ErrorBox, Empty, Chip, CategoryBadge, ScoreRing, Modal, EngineBanner, Notice } from '../components/ui.jsx'
import ScoreBreakdown from '../components/ScoreBreakdown.jsx'
import { SkillGapChart, BreakdownRadar } from '../components/SkillGap.jsx'

function List({ items, icon: Icon, tone }) {
  if (!items?.length) return <p className="text-sm italic text-slate-500">None.</p>
  return <ul className="space-y-1.5">{items.map((s, i) => <li key={i} className={`flex gap-2 text-sm ${tone}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span className="text-slate-300">{s}</span></li>)}</ul>
}

function ReportModal({ jobId, resumeId, onClose }) {
  const [tab, setTab] = useState('report')
  const [rep, setRep] = useState(null)
  const [iq, setIq] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setRep(null); setIq(null); setTab('report'); if (!resumeId) return
    api.report(jobId, resumeId).then(setRep).catch((e) => setError(e.message)) }, [jobId, resumeId])
  useEffect(() => { if (tab === 'interview' && !iq && resumeId) api.interview(jobId, resumeId).then(setIq).catch((e) => setError(e.message)) }, [tab])

  return (
    <Modal open={!!resumeId} onClose={onClose} wide title={rep ? `${rep.candidate.name} · ${rep.job.title}` : 'Explainable AI report'}>
      <ErrorBox error={error} />
      {!rep ? <Spinner label="Generating report…" /> : (<>
        <div className="mb-4 flex gap-1 border-b border-white/10">
          {[['report', 'Explainable report'], ['gap', 'Skill gap'], ['interview', 'Interview questions']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-brand-blue text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>{l}</button>))}</div>

        {tab === 'report' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="flex items-center gap-4"><ScoreRing value={rep.match.total} size={84} stroke={9} />
                <div><CategoryBadge category={rep.match.category} /><p className="mt-2 text-xs text-slate-400">{rep.match.explanation.summary}</p></div></div>
              <div><div className="label">How the score was calculated</div><ScoreBreakdown breakdown={rep.match.breakdown} /></div>
              <BreakdownRadar breakdown={rep.match.breakdown} />
            </div>
            <div className="space-y-5">
              <div><div className="label">Matched skills</div><div className="flex flex-wrap gap-1.5">
                {rep.match.exact_skills.map((s) => <Chip key={s} tone="good">{s}</Chip>)}
                {rep.match.semantic_skills.map((s) => <Chip key={s.skill} tone="blue">{s.skill} (semantic)</Chip>)}
                {!rep.match.matched_skills.length && <span className="text-sm italic text-slate-500">None</span>}</div></div>
              <div><div className="label">Missing skills</div><div className="flex flex-wrap gap-1.5">
                {rep.match.missing_skills.map((s) => <Chip key={s} tone="bad">{s}</Chip>)}
                {!rep.match.missing_skills.length && <span className="text-sm italic text-slate-500">None. All required skills are covered.</span>}</div></div>
              <div><div className="label">Strengths</div><List items={rep.match.explanation.strengths} icon={ThumbsUp} tone="text-emerald-400" /></div>
              <div><div className="label">Concerns</div><List items={rep.match.explanation.concerns} icon={AlertTriangle} tone="text-amber-400" /></div>
              <div><div className="label">Improvement suggestions</div><List items={rep.match.explanation.improvement_suggestions} icon={Lightbulb} tone="text-sky-400" /></div>
              <Notice>{rep.fairness_note}</Notice>
              <EngineBanner engine={rep.engine} />
            </div>
          </div>)}
        {tab === 'gap' && <SkillGapChart gap={rep.skill_gap} />}
        {tab === 'interview' && (!iq ? <Spinner label="Generating questions…" /> : (
          <div className="space-y-5">
            {[['technical', 'Technical'], ['projects', 'Projects'], ['experience', 'Experience-based'], ['problem_solving', 'Problem-solving']].map(([k, l]) => (
              <div key={k}><div className="label">{l}</div><ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">{iq[k].map((q, i) => <li key={i}>{q}</li>)}</ol></div>))}
            <p className="text-xs text-slate-500">{iq.generation}</p></div>))}
      </>)}
    </Modal>
  )
}

function CompareModal({ jobId, ids, onClose }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setD(null); if (ids) api.compare(jobId, ids).then(setD).catch((e) => setError(e.message)) }, [jobId, ids])
  const rows = d && [
    ['Match score', (c) => <span className="text-lg font-bold text-white">{c.total}%</span>],
    ['Category', (c) => <CategoryBadge category={c.category} />],
    ['Experience', (c) => `${c.profile.experience_years} years`],
    ['Education', (c) => c.profile.highest_education],
    ['Technical skills', (c) => <div className="flex flex-wrap gap-1">{c.profile.technical_skills.map((s) => <Chip key={s} tone={c.matched_skills.includes(s) ? 'good' : 'default'}>{s}</Chip>)}</div>],
    ['Skill gaps', (c) => <div className="flex flex-wrap gap-1">{c.missing_skills.length ? c.missing_skills.map((s) => <Chip key={s} tone="bad">{s}</Chip>) : <span className="text-emerald-400">None</span>}</div>],
    ['Projects', (c) => c.profile.projects.length ? c.profile.projects.map((p, i) => <div key={i} className="mb-1"><b className="text-slate-200">{p.name}</b><div className="text-xs text-slate-400">{p.description}</div></div>) : <span className="italic text-slate-500">None listed</span>],
    ['Score components', (c) => <ScoreBreakdown breakdown={c.breakdown} />],
  ]
  return (
    <Modal open={!!ids} onClose={onClose} wide title="Candidate comparison">
      <ErrorBox error={error} />
      {!d ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead><tr><th className="w-32 p-2 text-left" />{d.candidates.map((c) => <th key={c.profile.resume_id} className="p-2 text-left text-base text-white">{c.profile.name}</th>)}</tr></thead>
          <tbody>{rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-white/10 align-top"><td className="p-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</td>
              {d.candidates.map((c) => <td key={c.profile.resume_id} className="p-2 text-slate-300">{fn(c)}</td>)}</tr>))}</tbody></table></div>)}
    </Modal>
  )
}

export default function Matching() {
  const [params, setParams] = useSearchParams()
  const [jobs, setJobs] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ min_score: '', min_exp: '', min_edu: '', skills: '' })
  const [selected, setSelected] = useState([])
  const [report, setReport] = useState(null)
  const [compare, setCompare] = useState(null)
  const [exporting, setExporting] = useState('')
  const jobId = params.get('job')

  useEffect(() => { api.jobs().then((j) => { setJobs(j); if (!jobId && j.length) setParams({ job: j[0].id }, { replace: true }) }).catch((e) => setError(e.message)) }, [])
  const query = useMemo(() => {
    const q = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v !== '' && q.set(k, v))
    return q.toString() ? `?${q}` : ''
  }, [filters])
  useEffect(() => {
    if (!jobId) return
    setLoading(true); setError('')
    const t = setTimeout(() => api.ranking(jobId, query).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)), 250)
    return () => clearTimeout(t)
  }, [jobId, query])
  useEffect(() => setSelected([]), [jobId])

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id])
  const exportAs = async (fmt) => {
    setExporting(fmt)
    try { download(await api.exportFile(jobId, fmt), `talentiq_report.${fmt}`) } catch (e) { setError(e.message) } finally { setExporting('') }
  }
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  if (!jobs) return error ? <ErrorBox error={error} /> : <Spinner />
  if (!jobs.length) return <Empty title="Create a job first" hint="Rankings are calculated per job description." />

  return (
    <div>
      <PageHeader title="AI Candidate Matching" subtitle="Candidates are ranked by an explainable weighted score. Click a candidate for the full report.">
        <button className="btn-ghost" disabled={!!exporting} onClick={() => exportAs('csv')}>{exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV</button>
        <button className="btn-ghost" disabled={!!exporting} onClick={() => exportAs('pdf')}>{exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF</button>
        <button className="btn-primary" disabled={selected.length < 2} onClick={() => setCompare([...selected])}><GitCompare className="h-4 w-4" /> Compare ({selected.length})</button>
      </PageHeader>

      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><label className="label">Job</label><select className="input" value={jobId || ''} onChange={(e) => setParams({ job: e.target.value })}>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
        <div><label className="label">Min score %</label><input type="number" min="0" max="100" className="input" value={filters.min_score} onChange={set('min_score')} /></div>
        <div><label className="label">Min experience (yrs)</label><input type="number" min="0" className="input" value={filters.min_exp} onChange={set('min_exp')} /></div>
        <div><label className="label">Min education</label><select className="input" value={filters.min_edu} onChange={set('min_edu')}>
          <option value="">Any</option><option value="2">Diploma</option><option value="3">Bachelor's</option><option value="4">Master's</option><option value="5">PhD</option></select></div>
        <div className="sm:col-span-2 lg:col-span-5"><label className="label flex items-center gap-1"><Filter className="h-3 w-3" /> Must have skills (comma separated)</label>
          <input className="input" placeholder="e.g. Python, SQL" value={filters.skills} onChange={set('skills')} /></div>
      </div>

      <ErrorBox error={error} />
      {data && <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Weights:</span>{Object.entries(data.weights).map(([k, v]) => <Chip key={k}>{k} {Math.round(v * 100)}%</Chip>)}
          {data.blind_mode && <Chip tone="purple"><EyeOff className="mr-1 h-3 w-3" />Blind screening</Chip>}
          <span className="ml-auto">Showing {data.candidates.length} of {data.total_candidates}</span></div>
        <EngineBanner engine={data.engine} /></div>}

      {loading && !data ? <Spinner label="Scoring candidates…" /> : data && (data.candidates.length === 0 ?
        <Empty title="No candidates to show" hint={data.total_candidates ? 'No one passes the current filters.' : 'Upload resumes to screen them against this job.'} /> : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {data.candidates.map((c) => (
            <div key={c.resume_id} className="card animate-fadeUp !p-4 hover:border-brand-blue/40">
              <div className="flex flex-wrap items-center gap-4">
                <input type="checkbox" className="h-4 w-4 accent-brand-purple" checked={selected.includes(c.resume_id)} onChange={() => toggle(c.resume_id)} aria-label="Select for comparison" />
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${c.rank <= 3 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-ink-950' : 'bg-white/10 text-slate-300'}`}>{c.rank <= 3 ? <Medal className="h-4 w-4" /> : c.rank}</div>
                <ScoreRing value={c.total} size={56} stroke={6} />
                <div className="min-w-[160px] flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">#{c.rank} {c.name}</span><CategoryBadge category={c.category} /></div>
                  <div className="mt-1 text-xs text-slate-400">{c.experience_years} yrs · {c.education}</div></div>
                <div className="min-w-[220px] flex-[2] space-y-1">
                  <div className="flex flex-wrap gap-1">{c.matched_skills.slice(0, 6).map((s) => <Chip key={s} tone="good">{s}</Chip>)}{c.matched_skills.length > 6 && <Chip>+{c.matched_skills.length - 6}</Chip>}</div>
                  <div className="flex flex-wrap gap-1">{c.missing_skills.slice(0, 5).map((s) => <Chip key={s} tone="bad">{s}</Chip>)}{c.missing_skills.length > 5 && <Chip>+{c.missing_skills.length - 5}</Chip>}</div></div>
                <button className="btn-ghost" onClick={() => setReport(c.resume_id)}><MessageSquareText className="h-4 w-4" /> Why this score?</button>
              </div>
            </div>))}
        </div>))}
      {selected.length === 3 && <p className="mt-2 text-xs text-slate-500">Maximum of 3 candidates selected.</p>}
      <ReportModal jobId={jobId} resumeId={report} onClose={() => setReport(null)} />
      <CompareModal jobId={jobId} ids={compare} onClose={() => setCompare(null)} />
    </div>
  )
}
