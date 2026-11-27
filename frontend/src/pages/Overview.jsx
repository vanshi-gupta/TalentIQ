import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Briefcase, CheckCheck, Gauge, Activity as ActivityIcon, Crown } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../api.js'
import { PageHeader, Stat, Spinner, ErrorBox, ChartTip, CategoryBadge, CATEGORY_COLOR, Empty, ScoreRing } from '../components/ui.jsx'

export default function Overview() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.analytics().then(setD).catch((e) => setError(e.message)) }, [])
  if (error) return <ErrorBox error={error} />
  if (!d) return <Spinner label="Loading dashboard…" />
  const t = d.totals
  const empty = t.resumes === 0 && t.jobs === 0

  return (
    <div>
      <PageHeader title="Recruiter Overview" subtitle="Live statistics from your screened candidates and job postings." />
      {empty && <Empty title="Nothing here yet" hint="Post a job and upload resumes, or sign in with Demo recruiter from the login page to see the platform with sample data."
        action={<div className="mt-2 flex gap-2"><Link to="/recruiter/jobs" className="btn-primary">Post a job</Link><Link to="/recruiter/resumes" className="btn-ghost">Upload resumes</Link></div>} />}
      {!empty && (<>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={FileText} label="Resumes uploaded" value={t.resumes} />
          <Stat icon={Briefcase} label="Jobs posted" value={t.jobs} accent="text-brand-purple" />
          <Stat icon={CheckCheck} label="Candidates screened" value={t.screened} accent="text-emerald-400" />
          <Stat icon={Gauge} label="Avg. match score" value={`${t.avg_score}%`} accent="text-amber-400" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card">
            <h3 className="mb-3 font-semibold text-white">Match categories</h3>
            <div className="h-56">
              <ResponsiveContainer><PieChart>
                <Pie data={d.category_distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                  {d.category_distribution.map((c) => <Cell key={c.name} fill={CATEGORY_COLOR[c.name]} />)}
                </Pie><Tooltip content={<ChartTip />} /></PieChart></ResponsiveContainer>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-slate-400">
              {d.category_distribution.map((c) => <div key={c.name}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c.name] }} />{c.name.replace(' Match', '')}: {c.value}</div>)}
            </div>
          </div>
          <div className="card lg:col-span-2">
            <h3 className="mb-3 font-semibold text-white">Most demanded skills</h3>
            <div className="h-64">
              <ResponsiveContainer><BarChart data={d.skill_demand} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="skill" width={100} stroke="#94a3b8" fontSize={11} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <RBar dataKey="count" name="Jobs requiring" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-white"><Crown className="h-4 w-4 text-amber-400" /> Top-performing candidates</h3>
            {d.top_candidates.length === 0 ? <p className="text-sm text-slate-400">No screening results yet.</p> : (
              <ul className="space-y-3">{d.top_candidates.map((c, i) => (
                <li key={c.resume_id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-slate-500">{i + 1}</span>
                  <ScoreRing value={c.score} size={46} stroke={5} />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium text-white">{c.name}</div><div className="truncate text-xs text-slate-400">best for {c.job}</div></div>
                  <CategoryBadge category={c.category} />
                </li>))}</ul>)}
          </div>
          <div className="card">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-white"><ActivityIcon className="h-4 w-4 text-brand-blue" /> Recent activity</h3>
            {d.recent_activity.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : (
              <ul className="space-y-3">{d.recent_activity.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                  <div><div className="text-slate-200">{a.text}</div><div className="text-xs text-slate-500">{new Date(a.at + 'Z').toLocaleString()}</div></div></li>))}</ul>)}
          </div>
        </div>
      </>)}
    </div>
  )
}
