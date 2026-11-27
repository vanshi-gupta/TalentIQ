import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lightbulb,
  AlertTriangle,
  Info,
  Sparkles,
  CheckCircle2,
  UploadCloud,
  Loader2,
  Pencil,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api.js'
import { Spinner, ErrorBox, Empty, Notice } from '../components/ui.jsx'

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
    label: 'Optimization Tip',
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
    card: 'border-teal-200 bg-teal-50/35',
    icon: Sparkles,
    iconColor: 'text-teal-600',
  },
}

export default function CandidateImprovements() {
  const [data, setData] = useState(null)
  const [recsData, setRecsData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const input = useRef()

  useEffect(() => {
    Promise.all([api.myProfile(), api.recommendations().catch(() => null)])
      .then(([prof, recs]) => {
        setData(prof)
        setRecsData(recs)
      })
      .catch((e) => setError(e.message))
  }, [])

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const updated = await api.uploadMyResume(file)
      setData(updated)
      const recs = await api.recommendations().catch(() => null)
      if (recs) setRecsData(recs)
      setMsg('Resume updated and re-analysed.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const improvements = data?.improvements || []
  const filtered = useMemo(
    () => (filter === 'all' ? improvements : improvements.filter((x) => x.severity === filter)),
    [improvements, filter],
  )

  const missingDemand = useMemo(() => {
    const counts = new Map()
    for (const r of recsData?.recommendations || []) {
      for (const s of r.missing_skills || []) {
        counts.set(s, (counts.get(s) || 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [recsData])

  if (!data && !error) return <Spinner label="Analyzing resume improvements…" />
  if (error) return <ErrorBox error={error} />
  if (!data?.profile) {
    return (
      <Empty
        title="Upload your resume first"
        hint="Once your PDF or DOCX resume is parsed, you will see structural checks and practical improvements here."
        action={
          <Link to="/candidate" className="btn-primary mt-2">
            Go to My Profile
          </Link>
        }
      />
    )
  }

  const highCount = improvements.filter((x) => x.severity === 'high').length
  const medCount = improvements.filter((x) => x.severity === 'medium').length
  const lowCount = improvements.filter((x) => x.severity === 'low' || x.severity === 'info').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-indigo-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Lightbulb className="h-3.5 w-3.5" /> Resume Quality & Structure Review
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#172554] sm:text-3xl">
            Resume Improvement
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Rule-based review of your uploaded resume ({data.filename}) — only add skills and experience you genuinely have.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/candidate" className="btn-ghost">
            <Pencil className="h-4 w-4" /> Edit Profile
          </Link>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => input.current.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload Updated Resume
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

      {msg && <Notice>{msg}</Notice>}

      {/* KPI Counters */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-rose-700">
            <span>Structural / High Priority</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{highCount}</div>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-amber-800">
            <span>Recommended Improvements</span>
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{medCount}</div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-indigo-700">
            <span>Polish & Optimization Tips</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{lowCount}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Improvement Cards */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-[#172554]">
              Filter Suggestions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['all', `All (${improvements.length})`],
                ['high', `High (${highCount})`],
                ['medium', `Recommended (${medCount})`],
                ['low', `Polish`],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    filter === k
                      ? 'bg-indigo-600 text-white'
                      : 'border border-indigo-100 bg-[#F8FAFC] text-[#475569] hover:bg-indigo-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty
              title="No items in this category"
              hint="Try selecting All to view every resume check."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((s, i) => {
                const meta = SEVERITY_META[s.severity] || SEVERITY_META.info
                const Icon = meta.icon
                return (
                  <div key={i} className={`rounded-2xl border p-4 shadow-sm ${meta.card}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
                        <Icon className={`h-3.5 w-3.5 ${meta.iconColor}`} />
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide text-[#475569]">
                        {s.area}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-[#1E293B]">{s.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Missing High-Demand Skills */}
        <div className="space-y-5 lg:col-span-4">
          <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-[#172554]">High-Demand Missing Skills</h3>
            </div>
            <p className="mb-3 text-xs text-[#64748B]">
              Skills requested by open jobs that are not currently evidenced on your resume:
            </p>
            {missingDemand.length ? (
              <div className="space-y-2">
                {missingDemand.map(([skill, count]) => (
                  <div
                    key={skill}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-[#172554]">{skill}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {count} job{count === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-medium text-teal-700">
                Your resume already covers the required skills for all open roles.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
