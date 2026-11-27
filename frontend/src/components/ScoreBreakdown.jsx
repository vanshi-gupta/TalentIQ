import { Bar, scoreColor } from './ui.jsx'

const LABEL = { skills: 'Skills match', experience: 'Experience match', education: 'Education match', semantic: 'Semantic relevance' }

export default function ScoreBreakdown({ breakdown }) {
  return (
    <div className="space-y-3">
      {Object.entries(breakdown).map(([k, v]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-300">{LABEL[k]} <span className="text-slate-500">· weight {v.weight}%</span></span>
            <span className="text-slate-400">{v.score}% → <b className="text-white">{v.contribution} pts</b></span></div>
          <Bar value={v.score} color={scoreColor(v.score)} />
        </div>))}
    </div>
  )
}
