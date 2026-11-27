import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Spinner } from './components/ui.jsx'
import Auth from './pages/Auth.jsx'
import Overview from './pages/Overview.jsx'
import Jobs from './pages/Jobs.jsx'
import Resumes from './pages/Resumes.jsx'
import Matching from './pages/Matching.jsx'
import Analytics from './pages/Analytics.jsx'
import Settings from './pages/Settings.jsx'
import CandidateProfile from './pages/CandidateProfile.jsx'
import CandidateJobs from './pages/CandidateJobs.jsx'
import CandidateInsights from './pages/CandidateInsights.jsx'
import CandidateImprovements from './pages/CandidateImprovements.jsx'
import CandidateRoadmap from './pages/CandidateRoadmap.jsx'

function Guard({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== role) return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Restoring your session…" />
  const home = user ? (user.role === 'recruiter' ? '/recruiter' : '/candidate') : null
  return (
    <Routes>
      <Route path="/" element={home ? <Navigate to={home} replace /> : <Auth />} />
      <Route element={user ? <Layout /> : <Navigate to="/" replace />}>
        <Route path="/recruiter" element={<Guard role="recruiter"><Overview /></Guard>} />
        <Route path="/recruiter/jobs" element={<Guard role="recruiter"><Jobs /></Guard>} />
        <Route path="/recruiter/resumes" element={<Guard role="recruiter"><Resumes /></Guard>} />
        <Route path="/recruiter/matching" element={<Guard role="recruiter"><Matching /></Guard>} />
        <Route path="/recruiter/analytics" element={<Guard role="recruiter"><Analytics /></Guard>} />
        <Route path="/recruiter/settings" element={<Guard role="recruiter"><Settings /></Guard>} />
        <Route path="/candidate" element={<Guard role="candidate"><CandidateProfile /></Guard>} />
        <Route path="/candidate/jobs" element={<Guard role="candidate"><CandidateJobs /></Guard>} />
        <Route path="/candidate/insights" element={<Guard role="candidate"><CandidateInsights /></Guard>} />
        <Route path="/candidate/improvements" element={<Guard role="candidate"><CandidateImprovements /></Guard>} />
        <Route path="/candidate/roadmap" element={<Guard role="candidate"><CandidateRoadmap /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
