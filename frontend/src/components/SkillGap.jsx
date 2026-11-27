import { Lightbulb } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { Chip } from './ui.jsx'

const STATUS = {
  Matched: { bar: '#34d399', w: 100, tone: 'good' },
  Implied: { bar: '#38bdf8', w: 70, tone: 'blue' },
  Missing: { bar: '#fb7185', w: 8, tone: 'bad' },
}

export function SkillGapChart({ gap }) {
  if (!gap.rows.length) return <p className="text-sm text-slate-400">This job lists no skills, so there is no gap to analyse.</p>
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>Coverage <b className="text-white">{gap.coverage}%</b></span>
        {Object.entries(STATUS).map(([k, v]) => <span key={k}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: v.bar }} />{k}{k === 'Implied' && ' (semantic)'}</span>)}
      </div>
      <div className="space-y-2">
        {gap.rows.map((r) => (
          <div key={r.skill} className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-sm sm:grid-cols-[140px_1fr_80px]">
            <span className="truncate text-slate-200">{r.skill}{!r.required && <span className="ml-1 text-[10px] text-slate-500">(pref.)</span>}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${STATUS[r.status].w}%`, background: STATUS[r.status].bar }} /></div>
            <Chip tone={STATUS[r.status].tone}>{r.status}</Chip>
          </div>))}
      </div>
      {gap.recommendations.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="label flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Recommended skills to learn</div>
          {gap.recommendations.map((r) => <div key={r.skill} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><b className="text-white">{r.skill}</b><div className="text-slate-400">{r.action}</div></div>)}
        </div>)}
    </div>
  )
}

export function BreakdownRadar({ breakdown }) {
  const data = Object.entries(breakdown).map(([k, v]) => ({ k: k[0].toUpperCase() + k.slice(1), v: v.score }))
  return (
    <div className="h-52"><ResponsiveContainer><RadarChart data={data} outerRadius="72%">
      <PolarGrid stroke="rgba(255,255,255,.12)" /><PolarAngleAxis dataKey="k" tick={{ fill: '#94a3b8', fontSize: 11 }} />
      <Radar dataKey="v" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></div>
  )
}
