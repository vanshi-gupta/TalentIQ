import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  FileUp,
  Trophy,
  BarChart3,
  LogOut,
  Menu,
  X,
  UserCircle,
  Sparkles,
  Settings,
  Lightbulb,
  Compass,
} from 'lucide-react'
import { Logo } from './Logo.jsx'
import { useAuth } from '../auth.jsx'

const RECRUITER = [
  { to: '/recruiter', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/recruiter/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/recruiter/resumes', label: 'Resumes', icon: FileUp },
  { to: '/recruiter/matching', label: 'Matching & Ranking', icon: Trophy },
  { to: '/recruiter/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/recruiter/settings', label: 'Settings', icon: Settings },
]
const CANDIDATE = [
  { to: '/candidate', label: 'My Profile', icon: UserCircle, end: true },
  { to: '/candidate/jobs', label: 'Job Matches', icon: Sparkles },
  { to: '/candidate/insights', label: 'Match Insights', icon: BarChart3 },
  { to: '/candidate/improvements', label: 'Resume Improvement', icon: Lightbulb },
  { to: '/candidate/roadmap', label: 'Career Roadmap', icon: Compass },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const items = user.role === 'recruiter' ? RECRUITER : CANDIDATE

  const links = (
    <nav className="mt-6 flex flex-col gap-1.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[#334155] hover:bg-indigo-100/70 hover:text-[#172554]'
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="relative hidden w-64 shrink-0 border-r border-indigo-100 bg-[#F5F3FF] p-5 lg:flex lg:flex-col lg:justify-between">
        <div>
          <Logo />
          <div className="mt-6 px-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700/80">
            {user.role === 'recruiter' ? 'Recruiter Workspace' : 'Candidate Portal'}
          </div>
          {links}
        </div>
        <div className="rounded-xl border border-indigo-200/70 bg-white/80 px-3.5 py-2.5 text-xs text-[#475569]">
          Signed in as <span className="font-semibold capitalize text-[#172554]">{user.role}</span>
        </div>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button className="btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <Logo size={28} />
          </div>
          <div className="hidden text-sm text-[#475569] lg:block">
            {user.role === 'recruiter' && user.settings?.blind_mode && <span className="chip border-brand-purple/40 bg-brand-purple/10 text-violet-300">Blind screening ON</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-semibold text-[#172554]">{user.name}</div>
              <div className="text-xs text-[#64748B]">{user.email}</div>
            </div>
            <button className="btn-ghost" onClick={() => { logout(); nav('/') }}><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-8"><Outlet /></main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 border-r border-indigo-100 bg-[#F5F3FF] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Logo size={30} />
              <button className="btn-ghost !p-1.5" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
            {links}
          </aside>
        </div>
      )}
    </div>
  )
}
