import { useEffect } from 'react'
import { X, Loader2, Inbox, AlertCircle, CheckCircle2 } from 'lucide-react'

export const CATEGORY_STYLE = {
  'Excellent Match': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  'Strong Match': 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  'Moderate Match': 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  'Low Match': 'border-rose-400/40 bg-rose-400/10 text-rose-300',
}
export const CATEGORY_COLOR = {
  'Excellent Match': '#34d399', 'Strong Match': '#38bdf8', 'Moderate Match': '#fbbf24', 'Low Match': '#fb7185',
}
export const scoreColor = (s) => (s >= 80 ? '#34d399' : s >= 65 ? '#38bdf8' : s >= 45 ? '#fbbf24' : '#fb7185')

export function CategoryBadge({ category }) {
  return <span className={`chip ${CATEGORY_STYLE[category] || ''}`}>{category}</span>
}

export function Chip({ children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-slate-300',
    good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    bad: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    blue: 'border-brand-blue/30 bg-brand-blue/10 text-sky-300',
    purple: 'border-brand-purple/30 bg-brand-purple/10 text-violet-300',
  }
  return <span className={`chip ${tones[tone]}`}>{children}</span>
}

export function ScoreRing({ value, size = 64, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const percentage = Math.min(100, Math.max(0, Number(value) || 0));
  const offset = c - (percentage / 100) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#E5E7EB"
          strokeWidth={stroke}
          fill="none"
        />

        {/* Percentage arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#EAB308"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>

      {/* Percentage text */}
      <div className="absolute inset-0 grid place-items-center text-sm font-bold text-slate-800">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}

export function Bar({ value, color = '#3b82f6' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin text-brand-blue" /> {label}
    </div>
  )
}

export function Empty({ title, hint, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-500" />
      <div className="font-semibold text-white">{title}</div>
      {hint && <div className="max-w-md text-sm text-slate-400">{hint}</div>}
      {action}
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
    </div>
  )
}

export function Notice({ children, tone = 'info' }) {
  const t = tone === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-brand-blue/30 bg-brand-blue/10 text-sky-200'
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${t}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span></div>
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Stat({ icon: Icon, label, value, accent = 'text-brand-blue' }) {
  return (
    <div className="card animate-fadeUp">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        {Icon && <Icon className={`h-5 w-5 ${accent}`} />}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <div className={`glass w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} bg-ink-800/95 p-5 animate-fadeUp`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-white">{label ?? payload[0].name}</div>
      {payload.map((p, i) => <div key={i} className="text-slate-300">{p.name}: <b className="text-white">{p.value}</b></div>)}
    </div>
  )
}

export function EngineBanner({ engine }) {
  if (!engine) return null
  const ok = engine.contextual
  return (
    <div className={`rounded-xl border p-3 text-xs ${ok ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
      <b>Semantic engine: {engine.model}.</b> {engine.note}
    </div>
  )
}
