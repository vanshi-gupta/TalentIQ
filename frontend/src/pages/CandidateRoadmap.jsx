import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Compass,
  CheckCircle2,
  Circle,
  Target,
  Lightbulb,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { api } from '../api.js'
import { Spinner, ErrorBox, Empty } from '../components/ui.jsx'

const CHECK_KEY = 'talentiq_roadmap_checks_v1'

function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function CandidateRoadmap() {
  const [profileData, setProfileData] = useState(null)
  const [recsData, setRecsData] = useState(null)
  const [gapData, setGapData] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [checks, setChecks] = useState(loadChecks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const prof = await api.myProfile()
        if (cancelled) return
        setProfileData(prof)
        if (!prof?.profile) {
          setLoading(false)
          return
        }
        const recs = await api.recommendations()
        if (cancelled) return
        setRecsData(recs)
        if (recs?.recommendations?.length) {
          setSelectedJobId(String(recs.recommendations[0].job.id))
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedJobId) return
    let cancelled = false
    api
      .gap(selectedJobId)
      .then((d) => {
        if (!cancelled) setGapData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [selectedJobId])

  const toggleStep = (stepId) => {
    setChecks((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] }
      try {
        localStorage.setItem(CHECK_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const recs = recsData?.recommendations || []

  const phases = useMemo(() => {
    if (!gapData) return []
    const rows = gapData.skill_gap?.rows || []
    const tipMap = new Map((gapData.skill_gap?.recommendations || []).map((r) => [r.skill, r.action]))
    const missingRequired = rows.filter((r) => r.required && r.status === 'Missing')
    const missingPreferred = rows.filter((r) => !r.required && r.status === 'Missing')
    const resumeQuickWins = (gapData.improvements || [])
      .filter((x) => x.severity === 'high' || x.severity === 'medium')
      .slice(0, 4)

    return [
      {
        id: 'phase-1',
        title: 'Phase 1 · Resume & Profile Readiness',
        subtitle: 'Immediate fixes so parsers and recruiters see your true background.',
        icon: Lightbulb,
        items: resumeQuickWins.map((x, idx) => ({
          id: `${selectedJobId}-p1-${idx}`,
          title: `${x.area}: ${x.message}`,
          tag: x.severity,
        })),
      },
      {
        id: 'phase-2',
        title: 'Phase 2 · Core Required Skills',
        subtitle: 'Required skills for your target role that are not yet evidenced on your resume.',
        icon: Target,
        items: missingRequired.map((r) => ({
          id: `${selectedJobId}-req-${r.skill}`,
          title: `Build & demonstrate ${r.skill}`,
          detail: tipMap.get(r.skill) || '',
          tag: 'Required',
        })),
      },
      {
        id: 'phase-3',
        title: 'Phase 3 · Preferred Differentiators',
        subtitle: 'Optional skills that push your match from competitive to standout.',
        icon: BookOpen,
        items: missingPreferred.map((r) => ({
          id: `${selectedJobId}-pref-${r.skill}`,
          title: `Explore ${r.skill}`,
          detail: tipMap.get(r.skill) || '',
          tag: 'Preferred',
        })),
      },
    ].filter((p) => p.items.length > 0)
  }, [gapData, selectedJobId])

  const allItems = phases.flatMap((p) => p.items)
  const completedCount = allItems.filter((i) => checks[i.id]).length
  const progressPct = allItems.length ? Math.round((completedCount / allItems.length) * 100) : 100

  if (loading) return <Spinner label="Building your career roadmap…" />
  if (error) return <ErrorBox error={error} />
  if (!profileData?.profile) {
    return (
      <Empty
        title="Upload your resume to generate a roadmap"
        hint="Your Career Roadmap is personalized from your parsed profile and real open job requirements."
        action={
          <Link to="/candidate" className="btn-primary mt-2">
            Go to My Profile
          </Link>
        }
      />
    )
  }

  if (!recs.length) {
    return (
      <Empty
        title="No target jobs available yet"
        hint="Once recruiters post open jobs, your Career Roadmap will map out the exact skills needed for each role."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-indigo-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Compass className="h-3.5 w-3.5" /> Personalized Action Plan
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#172554] sm:text-3xl">
            Career Roadmap
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Step-by-step skill and resume milestones tailored to your chosen target role.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Target Role
          </label>
          <select
            className="input"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            {recs.map((r) => (
              <option key={r.job.id} value={r.job.id}>
                {r.job.title} ({Math.round(r.total)}% match)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Card */}
      <div className="rounded-2xl border border-indigo-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h2 className="text-base font-bold text-[#172554]">
                Roadmap for {gapData?.job?.title || recs[0].job.title}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#475569]">
              {allItems.length
                ? `${completedCount} of ${allItems.length} action items completed (${progressPct}%)`
                : 'You already meet all tracked skill and resume criteria for this role.'}
            </p>
          </div>
          <Link to="/candidate/jobs" className="btn-ghost self-start sm:self-auto">
            Compare All Jobs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Roadmap Phases */}
      {!phases.length ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6 text-sm text-[#172554]">
          <div className="flex items-center gap-2 font-bold text-teal-800">
            <CheckCircle2 className="h-5 w-5 text-teal-600" /> Ready to Apply
          </div>
          <p className="mt-1 text-xs text-[#334155]">
            Your resume covers all required and preferred skills detected for this position.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {phases.map((phase) => {
            const Icon = phase.icon
            return (
              <div key={phase.id} className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#172554]">{phase.title}</h3>
                    <p className="text-xs text-[#64748B]">{phase.subtitle}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {phase.items.map((item) => {
                    const done = Boolean(checks[item.id])
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleStep(item.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                          done
                            ? 'border-teal-200 bg-teal-50/40'
                            : 'border-slate-200/80 bg-[#F8FAFC] hover:border-indigo-200 hover:bg-indigo-50/30'
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-sm font-semibold ${done ? 'text-teal-900 line-through' : 'text-[#172554]'}`}>
                              {item.title}
                            </span>
                            <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                              {item.tag}
                            </span>
                          </div>
                          {item.detail && (
                            <p className="mt-1 text-xs leading-5 text-[#475569]">{item.detail}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
