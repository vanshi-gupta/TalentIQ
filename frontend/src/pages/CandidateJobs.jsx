import { useEffect, useMemo, useState } from 'react'
import { MapPin, Clock, Target, Sparkles, Search, CheckCircle2, AlertCircle, TrendingUp, Briefcase } from 'lucide-react'
import { api } from '../api.js'
import { Spinner, ErrorBox, Empty, Modal } from '../components/ui.jsx'
import { Link } from 'react-router-dom'

const CATEGORY_PILL = {
  'Excellent Match': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Strong Match': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'Moderate Match': 'border-amber-200 bg-amber-50 text-amber-800',
  'Low Match': 'border-rose-200 bg-rose-50 text-rose-700',
}

const SCORE_HEX = (v) => (v >= 80 ? '#0D9488' : v >= 65 ? '#4F46E5' : v >= 45 ? '#D97706' : '#E11D48')

const COMPONENT_LABELS = {
  skills: 'Skills match',
  experience: 'Experience match',
  education: 'Education match',
  semantic: 'Semantic relevance',
}

const GAP_STATUS = {
  Matched: { bar: '#0D9488', width: 100, badge: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  Implied: { bar: '#4F46E5', width: 72, badge: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  Missing: { bar: '#FB7185', width: 10, badge: 'border-rose-200 bg-rose-50 text-rose-700' },
}

function LightScoreRing({ value, size = 68, stroke = 7 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  const offset = c - (pct / 100) * c
  const color = SCORE_HEX(pct)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-bold text-[#172554]">
        {Math.round(pct)}%
      </div>
    </div>
  )
}

function GapModal({ jobId, onClose }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setD(null)
    setError('')
    if (jobId) api.gap(jobId).then(setD).catch((e) => setError(e.message))
  }, [jobId])

  return (
    <Modal
      open={!!jobId}
      onClose={onClose}
      wide
      title={
        <span className="text-[#172554]">
          {d ? `Skill Gap & Match Breakdown · ${d.job.title}` : 'Skill gap analysis'}
        </span>
      }
    >
      <ErrorBox error={error} />
      {!d ? (
        !error && <Spinner label="Analyzing skill gap…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Score Breakdown & Suggestions */}
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-[#F5F3FF]/60 p-4">
              <LightScoreRing value={d.match.total} size={72} />
              <div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_PILL[d.match.category] || 'border-slate-200 bg-slate-50 text-[#172554]'}`}>
                  {d.match.category}
                </span>
                {d.match.explanation?.summary && (
                  <p className="mt-1.5 text-xs leading-5 text-[#475569]">{d.match.explanation.summary}</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[#172554]">
                Score Breakdown
              </div>
              <div className="space-y-3">
                {Object.entries(d.match.breakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-[#1E293B]">
                        {COMPONENT_LABELS[k] || k}{' '}
                        <span className="text-[#64748B]">· weight {v.weight}%</span>
                      </span>
                      <span className="text-[#475569]">
                        {v.score}% → <b className="text-[#172554]">{v.contribution} pts</b>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, v.score)}%`, background: SCORE_HEX(v.score) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#172554]">
                Personalised Career Suggestions
              </div>
              <ul className="space-y-2">
                {d.improvements
                  .filter((x) => ['Target role', 'Skills', 'Projects', 'Certifications'].includes(x.area))
                  .slice(0, 6)
                  .map((s, i) => (
                    <li key={i} className="rounded-xl border border-indigo-100 bg-[#F8FAFC] p-3 text-xs leading-5 text-[#1E293B]">
                      <span className="mr-1.5 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        {s.area}
                      </span>
                      <span>{s.message}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Right: Skill Gap Rows & Learning Actions */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#172554]">Required & Preferred Skills</span>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  Coverage {d.skill_gap.coverage}%
                </span>
              </div>
              {!d.skill_gap.rows.length ? (
                <p className="text-xs text-[#64748B]">This job lists no skills, so there is no gap to analyse.</p>
              ) : (
                <div className="space-y-2.5">
                  {d.skill_gap.rows.map((r) => {
                    const st = GAP_STATUS[r.status] || GAP_STATUS.Missing
                    return (
                      <div key={r.skill} className="grid grid-cols-[120px_1fr_76px] items-center gap-2.5 text-xs sm:grid-cols-[140px_1fr_82px]">
                        <span className="truncate font-medium text-[#172554]">
                          {r.skill}
                          {!r.required && <span className="ml-1 text-[10px] text-[#64748B]">(pref.)</span>}
                        </span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${st.width}%`, background: st.bar }} />
                        </div>
                        <span className={`inline-flex justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.badge}`}>
                          {r.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {d.skill_gap.recommendations?.length > 0 && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
                <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-[#172554]">
                  Recommended Skills to Build
                </div>
                <div className="space-y-2">
                  {d.skill_gap.recommendations.map((rec) => (
                    <div key={rec.skill} className="rounded-xl border border-amber-200/70 bg-white p-3 text-xs">
                      <div className="font-bold text-[#172554]">{rec.skill}</div>
                      <div className="mt-0.5 text-[#475569]">{rec.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function CandidateJobs() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [gap, setGap] = useState(null)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('all')

  useEffect(() => {
    api.recommendations().then(setData).catch((e) => setError(e.message))
  }, [])

  const recs = data?.recommendations || []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recs.filter((r) => {
      if (tier === 'strong' && r.total < 65) return false
      if (tier === 'excellent' && r.total < 80) return false
      if (!q) return true
      const hay = `${r.job.title} ${r.job.location || ''} ${r.matched_skills.join(' ')} ${r.missing_skills.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [recs, search, tier])

  const strongCount = recs.filter((r) => r.total >= 65).length
  const bestScore = recs.length ? Math.round(Math.max(...recs.map((r) => r.total))) : 0

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#172554]">Recommended Jobs</h1>
        <ErrorBox error={error} />
        <Link to="/candidate" className="btn-primary inline-flex">
          Go to my profile
        </Link>
      </div>
    )
  }

  if (!data) return <Spinner label="Matching your profile against open jobs…" />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-indigo-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> Explainable Career Matching
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#172554] sm:text-3xl">
            Recommended Job Matches
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Open roles ranked by skills, experience, education, and semantic fit against your current profile.
          </p>
        </div>
        <Link to="/candidate" className="btn-ghost self-start sm:self-auto">
          Update My Profile
        </Link>
      </div>

      {/* KPI Summary & Engine Banner */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Open Positions Evaluated</span>
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{recs.length}</div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Strong+ Matches (65%+)</span>
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{strongCount}</div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Top Compatibility Score</span>
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#172554]">{bestScore}%</div>
        </div>
      </div>

      {data.engine && (
        <div className="rounded-xl border border-indigo-200/80 bg-[#F5F3FF]/70 px-4 py-2.5 text-xs text-[#334155]">
          <strong className="text-[#172554]">Matching Engine: {data.engine.model}.</strong> {data.engine.note}
        </div>
      )}

      {/* Filter Bar */}
      {recs.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              className="input pl-9"
              placeholder="Filter by role, location, or skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['all', `All (${recs.length})`],
              ['strong', `Strong 65%+ (${strongCount})`],
              ['excellent', `Excellent 80%+ (${recs.filter((r) => r.total >= 80).length})`],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTier(k)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  tier === k
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-indigo-100 bg-[#F8FAFC] text-[#475569] hover:bg-indigo-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job Cards */}
      {recs.length === 0 ? (
        <Empty title="No open jobs yet" hint="Check back once recruiters post jobs." />
      ) : filtered.length === 0 ? (
        <Empty title="No jobs match your filter" hint="Try clearing your search or selecting All matches." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((r) => (
            <div
              key={r.job.id}
              className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-start gap-4">
                  <LightScoreRing value={r.total} size={66} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-[#172554]">{r.job.title}</h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          CATEGORY_PILL[r.category] || 'border-slate-200 bg-slate-50 text-[#172554]'
                        }`}
                      >
                        {r.category}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[#475569]">
                      {r.job.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {r.job.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" /> {r.job.employment_type}
                      </span>
                      <span>{r.job.min_experience}+ yrs exp</span>
                    </div>
                  </div>
                </div>

                {r.explanation?.summary && (
                  <p className="mt-3 rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#475569]">
                    {r.explanation.summary}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Matched Skills ({r.matched_skills.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.matched_skills.length ? (
                        r.matched_skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic text-[#64748B]">No required skills matched yet</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Missing Skills ({r.missing_skills.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.missing_skills.length ? (
                        r.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-medium text-teal-700">All required skills covered</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" className="btn-ghost mt-5 w-full" onClick={() => setGap(r.job.id)}>
                <Target className="h-4 w-4" /> Skill gap & personalized suggestions
              </button>
            </div>
          ))}
        </div>
      )}

      <GapModal jobId={gap} onClose={() => setGap(null)} />
    </div>
  )
}
