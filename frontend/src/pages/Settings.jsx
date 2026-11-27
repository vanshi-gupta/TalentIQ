import { useState } from 'react'
import { Loader2, EyeOff, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { PageHeader, ErrorBox, Notice } from '../components/ui.jsx'

const DEFAULTS = { skills: 40, experience: 25, education: 15, semantic: 20 }
const LABELS = { skills: 'Skills match', experience: 'Experience match', education: 'Education match', semantic: 'Semantic relevance' }

export default function Settings() {
  const { user, setUser } = useAuth()
  const [w, setW] = useState(Object.fromEntries(Object.entries(user.settings.weights).map(([k, v]) => [k, Math.round(v * 100)])))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const total = Object.values(w).reduce((a, b) => a + Number(b), 0)

  const save = async (body, key, ok) => {
    setBusy(key); setError(''); setMsg('')
    try { setUser(await api.saveSettings(body)); setMsg(ok) } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Control how candidates are screened." />
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="flex items-center gap-2 font-semibold text-white"><EyeOff className="h-4 w-4 text-violet-300" /> Blind screening mode</h3>
            <p className="mt-1 text-sm text-slate-400">Hides candidate names, contact details, links, location and original files, and redacts identifiers and gendered words in displayed text. Rankings never use age, gender, religion, caste, photo or name, whether this is on or off.</p>
            <p className="mt-2 text-xs text-slate-500">Limitation: free-text may still contain indirect identifiers (e.g. employer or university names). TalentIQ does not extract or display photographs.</p></div>
          <button role="switch" aria-checked={user.settings.blind_mode} disabled={busy === 'blind'}
            onClick={() => save({ blind_mode: !user.settings.blind_mode }, 'blind', `Blind screening ${!user.settings.blind_mode ? 'enabled' : 'disabled'}.`)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${user.settings.blind_mode ? 'bg-brand-purple' : 'bg-white/15'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${user.settings.blind_mode ? 'left-6' : 'left-1'}`} /></button>
        </div>
      </div>

      <div className="card">
        <h3 className="flex items-center gap-2 font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-brand-blue" /> Scoring weights</h3>
        <p className="mt-1 text-sm text-slate-400">Weights are normalised to 100%. Saving re-scores every candidate for every job.</p>
        <div className="mt-4 space-y-4">
          {Object.keys(DEFAULTS).map((k) => (
            <div key={k}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{LABELS[k]}</span><b className="text-white">{w[k]}</b></div>
              <input type="range" min="0" max="100" value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} className="w-full accent-brand-purple" /></div>))}
        </div>
        <div className="mt-3 text-xs text-slate-400">Raw total: {total}. Effective weights: {total > 0 ? Object.entries(w).map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`).join(' · ') : 'set at least one weight above zero'}</div>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" disabled={!!busy || total <= 0} onClick={() => save({ weights: w }, 'weights', 'Weights saved and all candidates re-ranked.')}>{busy === 'weights' && <Loader2 className="h-4 w-4 animate-spin" />} Save & re-rank</button>
          <button className="btn-ghost" onClick={() => setW(DEFAULTS)}><RotateCcw className="h-4 w-4" /> Reset to default</button></div>
      </div>
      <div className="mt-4 space-y-2"><ErrorBox error={error} />{msg && <Notice>{msg}</Notice>}</div>
    </div>
  )
}
