import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Briefcase,
  GraduationCap,
  Layers,
  ArrowRight,
  ThumbsUp,
} from 'lucide-react'
import { api } from '../api.js'
import { Spinner, ErrorBox, Empty } from '../components/ui.jsx'

const CATEGORY_PILL = {
  'Excellent Match': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Strong Match': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'Moderate Match': 'border-amber-200 bg-amber-50 text-amber-800',
  'Low Match': 'border-rose-200 bg-rose-50 text-rose-700',
}

const SCORE_HEX = (v) => (v >= 80 ? '#0D9488' : v >= 65 ? '#4F46E5' : v >= 45 ? '#D97706' : '#E11D48')

const LABELS = {
  skills: 'Skills match',
  experience: 'Experience match',
  education: 'Education match',
  semantic: 'Semantic relevance',
}

export default function CandidateInsights() {
  const [profileData, setProfileData] = useState(null)
  const [recsData, setRecsData] = useState(null)
  const [gapData, setGapData] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  const recs = recsData?.recommendations || []
  const selectedRec = useMemo(
    () => recs.find((r) => String(r.job.id) === String(selectedJobId)) || recs[0] || null,
    [recs, selectedJobId],
  )

  if (loading) return <Spinner label="Loading match insights…" />
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBox error={error} />
        <Link to="/candidate" className="btn-primary inline-flex">
          Go to My Profile
        </Link>
      </div>
    )
  }

  if (!profileData?.profile) {
    return (
      <Empty
        title="No resume profile available yet"
        hint="Upload your PDF or DOCX resume on My Profile to see detailed match insights across open jobs."
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
        title="No open jobs to analyse yet"
        hint="Once recruiters post open positions, TalentIQ will show your score breakdown and cross-role insights here."
      />
    )
  }

  const breakdown = gapData?.match?.breakdown || selectedRec?.breakdown || {}
  const explanation = gapData?.match?.explanation || selectedRec?.explanation || {}
  const radarData = Object.entries(breakdown).map(([k, v]) => ({
    metric: k[0].toUpperCase() + k.slice(1),
    score: Math.round(v.score),
  }))
  const barData = recs.map((r) => ({
    name: r.job.title.length > 18 ? `${r.job.title.slice(0, 17)}…` : r.job.title,
    score: Math.round(r.total * 10) / 10,
  }))

  const activeScore = gapData?.match?.total ?? selectedRec?.total ?? 0
  const activeCategory = gapData?.match?.category ?? selectedRec?.category ?? 'Moderate Match'
  const coverage = gapData?.skill_gap?.coverage ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-indigo-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <BarChart3 className="h-3.5 w-3.5" /> Explainable Match Analytics
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#172554] sm:text-3xl">
            Match Insights
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            See exactly how your profile scores across skills, experience, education, and semantic fit.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#172554]">
            Inspect Role
          </label>
          <select
            className="input"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            {recs.map((r) => (
              <option key={r.job.id} value={r.job.id}>
                {r.job.title} ({Math.round(r.total)}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Overall Match</span>
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="text-2xl font-bold text-[#172554]">{activeScore}%</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_PILL[activeCategory] || ''}`}>
              {activeCategory}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Skill Coverage</span>
            <Layers className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#172554]">
            {coverage !== null ? `${coverage}%` : `${selectedRec?.matched_skills?.length || 0} matched`}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Experience Fit</span>
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#172554]">
            {profileData.profile.experience_years ?? 0} yrs
            <span className="ml-1.5 text-xs font-normal text-[#64748B]">
              / {selectedRec?.job?.min_experience ?? 0}+ req
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            <span>Education Level</span>
            <GraduationCap className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-2 truncate text-2xl font-bold text-[#172554]">
            {profileData.profile.highest_education || 'Not specified'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm lg:col-span-5">
          <h2 className="text-base font-bold text-[#172554]">Component Balance</h2>
          <p className="mt-0.5 text-xs text-[#64748B]">Weighted scoring dimensions for {selectedRec?.job?.title}</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12 }} />
                <Radar dataKey="score" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.28} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2.5">
            {Object.entries(breakdown).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-[#1E293B]">
                    {LABELS[k] || k} <span className="text-[#64748B]">({v.weight}%)</span>
                  </span>
                  <span className="font-semibold text-[#172554]">
                    {v.score}% · {v.contribution} pts
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, v.score)}%`, background: SCORE_HEX(v.score) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm lg:col-span-7">
          <h2 className="text-base font-bold text-[#172554]">Compatibility Across All Open Roles</h2>
          <p className="mt-0.5 text-xs text-[#64748B]">Compare how well your current resume fits each active opening</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ left: 16, right: 20 }}>
                <CartesianGrid stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="name" width={135} stroke="#334155" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DDD6FE',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#172554',
                  }}
                />
                <Bar dataKey="score" name="Match %" fill="#4F46E5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strengths & Gaps for Selected Job */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-teal-600" />
            <h3 className="text-base font-bold text-[#172554]">Why You Match This Role</h3>
          </div>
          {explanation.strengths?.length ? (
            <ul className="space-y-2.5">
              {explanation.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/40 p-3 text-xs leading-5 text-[#1E293B]">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-[#64748B]">No specific strengths recorded for this role yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-base font-bold text-[#172554]">Gaps & Areas to Address</h3>
            </div>
            <Link to="/candidate/roadmap" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
              Open Career Roadmap <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {explanation.concerns?.length ? (
            <ul className="space-y-2.5">
              {explanation.concerns.map((item, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-xs leading-5 text-[#1E293B]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-teal-700">No major gaps detected for this position.</p>
          )}
        </div>
      </div>
    </div>
  )
}
