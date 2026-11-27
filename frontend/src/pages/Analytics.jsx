import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from 'recharts'
import { api } from '../api.js'
import { PageHeader, Spinner, ErrorBox, ChartTip, Empty, EngineBanner } from '../components/ui.jsx'

const PALETTE = ['#3b82f6', '#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185']
const Panel = ({ title, children }) => <div className="card"><h3 className="mb-3 font-semibold text-white">{title}</h3><div className="h-64">{children}</div></div>
const axis = { stroke: '#64748b', fontSize: 11 }

function HBar({ data, k, color }) {
  return <ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ left: 16 }}>
    <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} />
    <YAxis type="category" dataKey={k} width={100} {...axis} stroke="#94a3b8" /><Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
    <Bar dataKey="count" name="Count" fill={color} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
}

export default function Analytics() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.analytics().then(setD).catch((e) => setError(e.message)) }, [])
  if (error) return <ErrorBox error={error} />
  if (!d) return <Spinner label="Crunching analytics…" />
  if (!d.totals.resumes) return <Empty title="No data yet" hint="Upload resumes and post jobs to see analytics." />
  const jobBars = d.per_job.map((j) => ({ name: j.title, avg: j.avg, top: j.top[0]?.score ?? 0 }))

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Everything is computed from your stored screening results." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Match score by job (average vs best candidate)">
          <ResponsiveContainer><BarChart data={jobBars}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(s) => (s.length > 14 ? s.slice(0, 13) + '…' : s)} /><YAxis domain={[0, 100]} {...axis} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
            <Bar dataKey="avg" name="Average %" fill="#3b82f6" radius={[6, 6, 0, 0]} /><Bar dataKey="top" name="Best %" fill="#8b5cf6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
        <Panel title="Match score distribution (all candidate–job pairs)">
          <ResponsiveContainer><BarChart data={d.score_distribution}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="range" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
            <Bar dataKey="count" name="Pairs" fill="#22d3ee" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
        <Panel title="Most common candidate skills"><HBar data={d.candidate_skills} k="skill" color="#3b82f6" /></Panel>
        <Panel title="Most demanded job skills"><HBar data={d.skill_demand} k="skill" color="#8b5cf6" /></Panel>
        <Panel title="Candidate qualifications">
          <ResponsiveContainer><PieChart><Pie data={d.qualifications} dataKey="value" nameKey="name" outerRadius={85} innerRadius={45} paddingAngle={3} stroke="none"
            label={({ name, value }) => `${name} (${value})`}>{d.qualifications.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip content={<ChartTip />} /></PieChart></ResponsiveContainer></Panel>
        <Panel title="Recruitment pipeline">
          <ResponsiveContainer><FunnelChart><Tooltip content={<ChartTip />} />
            <Funnel dataKey="count" nameKey="stage" data={d.pipeline.map((p, i) => ({ ...p, fill: PALETTE[i] }))} isAnimationActive>
              <LabelList position="right" fill="#e2e8f0" stroke="none" dataKey="stage" fontSize={11} /></Funnel></FunnelChart></ResponsiveContainer></Panel>
      </div>
      <div className="card mt-4">
        <h3 className="mb-3 font-semibold text-white">Top candidates per job</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.per_job.map((j) => (
          <div key={j.job_id} className="rounded-xl border border-white/10 p-3"><div className="mb-2 text-sm font-semibold text-white">{j.title}</div>
            {j.top.map((c, i) => <div key={i} className="flex justify-between py-0.5 text-sm"><span className="text-slate-300">{i + 1}. {c.name}</span><b className="text-white">{c.score}%</b></div>)}
            {!j.top.length && <span className="text-xs text-slate-500">No candidates yet</span>}</div>))}</div>
      </div>
      <div className="mt-4"><EngineBanner engine={d.engine} /></div>
      <p className="mt-3 text-xs text-slate-500">Export per-job screening reports as CSV or PDF from the Matching & Ranking page.</p>
    </div>
  )
}
