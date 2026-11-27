import { useEffect, useState } from 'react'
import { Briefcase, UserCircle, Loader2, Sparkles, ShieldCheck, Brain, Scale, Rocket } from 'lucide-react'
import { Logo } from '../components/Logo.jsx'
import { ErrorBox } from '../components/ui.jsx'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'

const FEATURES = [
  [Brain, 'Semantic matching', 'Understands that "built predictive models" means machine-learning experience.'],
  [Scale, 'Explainable scores', 'Every score is broken down into skills, experience, education and semantic fit.'],
  [ShieldCheck, 'Blind screening', 'Hide names and identifiers; protected traits never influence ranking.'],
]

export default function Auth() {
  const { login, register, demo } = useAuth()
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('recruiter')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(false)) }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const run = async (key, fn) => {
    setBusy(key); setError('')
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const submit = (e) => {
    e.preventDefault()
    run('form', () => (mode === 'login' ? login({ email: form.email, password: form.password }) : register({ ...form, role })))
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between p-8 lg:p-14">
        <Logo size={42} />
        <div className="my-10 max-w-xl animate-fadeUp">
          <span className="chip border-brand-purple/40 bg-brand-purple/10 text-violet-300"><Sparkles className="mr-1 h-3 w-3" /> AI-powered recruitment</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Screen resumes in seconds.<br />
            <span className="bg-gradient-to-r from-brand-blue via-brand-violet to-brand-purple bg-clip-text text-transparent">Understand every score.</span>
          </h1>
          <p className="mt-4 text-slate-400">TalentIQ extracts skills, education and experience from resumes with NLP, ranks candidates against job descriptions, and tells you exactly why.</p>
          <div className="mt-8 grid gap-3">
            {FEATURES.map(([Icon, t, d]) => (
              <div key={t} className="glass flex gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                <div><div className="font-semibold text-white">{t}</div><div className="text-sm text-slate-400">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {health === false && <span className="text-rose-300">Backend not reachable. Start it with <code>uvicorn app.main:app --port 8000</code>.</span>}
          {health && <span>Engine: {health.semantic_engine.model} · Entities: {health.parser.entity_extraction}</span>}
        </div>
      </section>

      <section className="grid place-items-center p-6 lg:p-12">
        <div className="glass w-full max-w-md bg-ink-800/80 p-7 animate-fadeUp">
          <h2 className="text-xl font-bold text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-slate-400">{mode === 'login' ? 'Sign in to continue.' : 'Choose how you will use TalentIQ.'}</p>

          {mode === 'register' && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[['recruiter', 'Recruiter', Briefcase], ['candidate', 'Candidate', UserCircle]].map(([r, label, Icon]) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold transition ${role === r ? 'border-brand-blue bg-brand-blue/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === 'register' && <div><label className="label">Full name</label><input className="input" value={form.name} onChange={set('name')} required /></div>}
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} required /></div>
            <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={set('password')} minLength={mode === 'register' ? 8 : undefined} required />
              {mode === 'register' && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}</div>
            <ErrorBox error={error} />
            <button className="btn-primary w-full" disabled={!!busy}>
              {busy === 'form' && <Loader2 className="h-4 w-4 animate-spin" />} {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <button className="mt-3 w-full text-center text-sm text-slate-400 hover:text-white" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? "New here? Create an account" : 'Already registered? Sign in'}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" /> DEMO MODE <span className="h-px flex-1 bg-white/10" /></div>
          <p className="mb-3 text-xs text-slate-400">One click loads fictional sample jobs and resumes that run through the real parsing and matching pipeline.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" disabled={!!busy} onClick={() => run('dr', () => demo('recruiter'))}>
              {busy === 'dr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Demo recruiter</button>
            <button className="btn-ghost" disabled={!!busy} onClick={() => run('dc', () => demo('candidate'))}>
              {busy === 'dc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Demo candidate</button>
          </div>
        </div>
      </section>
    </div>
  )
}
