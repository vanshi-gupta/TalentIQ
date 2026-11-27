import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Compass,
  CreditCard,
  EyeOff,
  FileText,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Badge } from './ui/primitives';
import { LoadingState } from './ui/states';

const recruiterNav = [
  { label: 'Dashboard', to: '/recruiter', icon: LayoutDashboard, end: true },
  { label: 'Jobs', to: '/recruiter/jobs', icon: BriefcaseBusiness },
  { label: 'Candidates', to: '/recruiter/candidates', icon: UsersRound },
  { label: 'Screening', to: '/recruiter/screening', icon: EyeOff },
  { label: 'Hiring Pipeline', to: '/recruiter/pipeline', icon: Kanban },
  { label: 'Reports', to: '/recruiter/reports', icon: BarChart3 },
  { label: 'Billing & Plans', to: '/recruiter/billing', icon: CreditCard },
  { label: 'Settings', to: '/recruiter/settings', icon: Settings2 },
];

const candidateNav = [
  { label: 'Dashboard', to: '/candidate', icon: LayoutDashboard, end: true },
  { label: 'Find Jobs', to: '/candidate/jobs', icon: Search },
  { label: 'My Applications', to: '/candidate/applications', icon: Compass },
  { label: 'My Resume', to: '/candidate/resume', icon: FileText },
  { label: 'Career Growth', to: '/candidate/growth', icon: GraduationCap },
  { label: 'Interview Prep', to: '/candidate/interview-prep', icon: MessageSquareText },
  { label: 'Settings', to: '/candidate/settings', icon: Settings2 },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="TalentIQ home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#9C7BFF] font-display text-base font-bold text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[17px] font-bold tracking-[-0.02em] text-plum-950">TalentIQ</span>
        {!compact && <span className="block text-[11px] font-medium text-plum-600">Hiring with Intelligence</span>}
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, subscription, logout } = useAuth();
  const navigate = useNavigate();
  const items = user?.role === 'recruiter' ? recruiterNav : candidateNav;

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="flex h-full flex-col bg-ivory">
      <div className="px-5 pb-5 pt-6">
        <Logo />
      </div>

      {user && (
        <div className="mx-3 mb-4 rounded-2xl border border-lavender-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={user.role === 'recruiter' ? 'violet' : 'info'}>
              {user.role === 'recruiter' ? 'Recruiter Portal' : 'Candidate Portal'}
            </Badge>
            {user.isDemo && <Badge variant="sample">Demo</Badge>}
          </div>
          <p className="mt-2 truncate text-xs font-bold text-plum-950">{user.fullName}</p>
          <p className="truncate text-[11px] text-plum-600">{user.email}</p>
          {user.role === 'recruiter' && (
            <p className="mt-1.5 text-[10px] font-semibold text-mint-700">
              {subscription ? `Plan: ${subscription.plan?.name ?? 'Active'}` : 'Free workspace · Upgrade available'}
            </p>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}
          >
            <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-lavender-100 px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="nav-item w-full text-peach-700 hover:bg-peach-100/70 hover:text-peach-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-plum-950/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-[272px] border-r border-lavender-200 bg-ivory shadow-lift">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-4 rounded-xl p-2 text-plum-600 hover:bg-lavender-100 hover:text-plum-950"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    document.title = `TalentIQ · ${user?.role === 'recruiter' ? 'Recruiter Workspace' : 'Candidate Portal'}`;
  }, [user?.role]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-lavender-200 bg-ivory lg:block">
        <SidebarContent />
      </aside>

      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-lavender-200 bg-ivory/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl p-2 text-plum-700 transition hover:bg-lavender-100 hover:text-plum-950"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Logo compact />
            </div>
            <Link
              to={user?.role === 'recruiter' ? '/recruiter/screening' : '/candidate/jobs'}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-lavender-200 bg-lavender-50 px-3 text-xs font-semibold text-plum-950"
            >
              {user?.role === 'recruiter' ? 'Blind Screening' : 'Find Jobs'}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-8 lg:px-10 lg:py-9">
          <Suspense fallback={<div className="py-16"><LoadingState label="Loading TalentIQ…" /></div>}>
            <Outlet />
          </Suspense>
          <footer className="mt-14 border-t border-lavender-100 py-5 text-xs text-plum-600">
            TalentIQ — Hiring with Intelligence. Growing with Opportunity.
          </footer>
        </main>
      </div>
    </div>
  );
}
