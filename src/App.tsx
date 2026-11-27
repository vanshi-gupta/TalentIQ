import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { LoadingState } from './components/ui/states';
import type { UserRole } from './types';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Candidates = lazy(() => import('./pages/Candidates'));
const CandidateDetail = lazy(() => import('./pages/CandidateDetail'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const Screening = lazy(() => import('./pages/Screening'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Reports = lazy(() => import('./pages/Reports'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));

const CandidateDashboard = lazy(() => import('./pages/candidate/CandidateDashboard'));
const FindJobs = lazy(() => import('./pages/candidate/FindJobs'));
const MyApplications = lazy(() => import('./pages/candidate/MyApplications'));
const MyResume = lazy(() => import('./pages/candidate/MyResume'));
const CareerGrowth = lazy(() => import('./pages/candidate/CareerGrowth'));
const InterviewPrep = lazy(() => import('./pages/candidate/InterviewPrep'));
const CandidateSettings = lazy(() => import('./pages/candidate/CandidateSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-24"><LoadingState label="Restoring session…" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />;
}

function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-24"><LoadingState label="Verifying access…" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-24"><LoadingState label="Loading TalentIQ…" /></div>;
  if (user) return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />

            {/* Recruiter Portal */}
            <Route path="/recruiter" element={<RequireRole role="recruiter"><Layout /></RequireRole>}>
              <Route index element={<Dashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="candidates" element={<Candidates />} />
              <Route path="candidates/:id" element={<CandidateDetail />} />
              <Route path="screening" element={<Screening />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="reports" element={<Reports />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Candidate Portal */}
            <Route path="/candidate" element={<RequireRole role="candidate"><Layout /></RequireRole>}>
              <Route index element={<CandidateDashboard />} />
              <Route path="jobs" element={<FindJobs />} />
              <Route path="applications" element={<MyApplications />} />
              <Route path="resume" element={<MyResume />} />
              <Route path="growth" element={<CareerGrowth />} />
              <Route path="interview-prep" element={<InterviewPrep />} />
              <Route path="settings" element={<CandidateSettings />} />
            </Route>

            {/* Legacy shortcut redirects */}
            <Route path="/jobs" element={<Navigate to="/recruiter/jobs" replace />} />
            <Route path="/candidates" element={<Navigate to="/recruiter/candidates" replace />} />
            <Route path="/screening" element={<Navigate to="/recruiter/screening" replace />} />
            <Route path="/reports" element={<Navigate to="/recruiter/reports" replace />} />
            <Route path="/settings" element={<Navigate to="/recruiter/settings" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
