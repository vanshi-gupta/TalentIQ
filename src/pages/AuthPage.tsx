import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  EyeOff,
  FileSearch,
  Lock,
  Radar,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, api } from '../services/api';
import { Badge, Button, Card, Field, inputClass } from '../components/ui/primitives';
import type { UserRole } from '../types';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function AuthPage() {
  const { login, register, demoLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('recruiter');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        toast.success(`Welcome back, ${user.fullName}.`);
        navigate(user.role === 'recruiter' ? '/recruiter' : '/candidate');
      } else if (mode === 'register') {
        const user = await register({ email, password, role, fullName, phone, company });
        toast.success('Your TalentIQ account is ready.');
        navigate(user.role === 'recruiter' ? '/recruiter' : '/candidate');
      } else if (mode === 'forgot') {
        const res = await api.auth.forgotPassword(email);
        setInfoMessage(res.message);
      } else if (mode === 'reset') {
        const res = await api.auth.resetPassword(resetToken, password);
        setInfoMessage(res.message);
        setMode('login');
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to complete authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (selectedRole: UserRole) => {
    setError(null);
    setDemoLoading(selectedRole);
    try {
      const user = await demoLogin(selectedRole);
      toast.info('Signed into labelled Demo Mode. Demo records stay separate from real accounts.');
      navigate(user.role === 'recruiter' ? '/recruiter' : '/candidate');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to launch demo workspace.');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-12">
        {/* Left Story Panel */}
        <div className="space-y-6 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-lavender-200 bg-white px-3.5 py-1.5 shadow-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-sm font-bold text-plum-950">TalentIQ</span>
            <Badge variant="violet">AI Recruitment Ecosystem</Badge>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-plum-950 sm:text-4xl">
              Hiring with Intelligence.<br />Growing with Opportunity.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-plum-700">
              Other platforms only tell recruiters who scored highest. TalentIQ explains why with verifiable resume evidence, protects fair evaluation through blind screening, checks timeline consistency, and guides candidates toward adjacent opportunities.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-lavender-200 bg-white/90 p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-plum-950">
                <FileSearch className="h-4 w-4 text-accent" />
                Explainable Match DNA
              </div>
              <p className="mt-1.5 text-xs leading-5 text-plum-700">Deterministic weighted scores backed by an auditable Evidence Ledger.</p>
            </div>
            <div className="rounded-2xl border border-[#A8DFCA] bg-mint-100/55 p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-mint-700">
                <EyeOff className="h-4 w-4" />
                Blind First, Reveal Later
              </div>
              <p className="mt-1.5 text-xs leading-5 text-plum-900">Server-redacted candidate profiles with audited identity reveal.</p>
            </div>
            <div className="rounded-2xl border border-[#F2D57A] bg-butter-100/55 p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-butter-700">
                <Radar className="h-4 w-4" />
                Resume Integrity Radar
              </div>
              <p className="mt-1.5 text-xs leading-5 text-plum-900">Rule-based date overlap and missing evidence checks for human review.</p>
            </div>
            <div className="rounded-2xl border border-[#A7CCF7] bg-babyblue-100/55 p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold text-babyblue-700">
                <Compass className="h-4 w-4" />
                Opportunity Beyond Rejection
              </div>
              <p className="mt-1.5 text-xs leading-5 text-plum-900">Transferable-skill alternative roles, skill bridges, and growth roadmaps.</p>
            </div>
          </div>

          {/* Optional Hackathon Demo Bar */}
          <Card className="border-[#F2D57A] bg-butter-100/45 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="sample">Optional Demo Mode</Badge>
                  <span className="text-xs font-bold text-plum-950">Interactive Walkthrough</span>
                </div>
                <p className="mt-1 text-xs text-plum-700">Explore TalentIQ with clearly labelled Indian sample data without creating an account.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={demoLoading === 'recruiter'} onClick={() => handleDemo('recruiter')}>
                  Demo Recruiter
                </Button>
                <Button size="sm" variant="outline" loading={demoLoading === 'candidate'} onClick={() => handleDemo('candidate')}>
                  Demo Candidate
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Auth Card */}
        <Card className="p-6 sm:p-8 lg:col-span-6">
          <div className="flex items-center justify-between gap-3 border-b border-lavender-100 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-plum-950">
                {mode === 'login' && 'Sign in to TalentIQ'}
                {mode === 'register' && 'Create your TalentIQ account'}
                {mode === 'forgot' && 'Reset your password'}
                {mode === 'reset' && 'Set a new password'}
              </h2>
              <p className="mt-1 text-xs text-plum-600">
                {mode === 'login' && 'Access your Recruiter workspace or Candidate growth portal.'}
                {mode === 'register' && 'Select your portal role to get started.'}
                {mode === 'forgot' && 'Enter your registered email to request a password reset.'}
                {mode === 'reset' && 'Enter your reset token and choose a strong password.'}
              </p>
            </div>
            <Lock className="h-5 w-5 text-accent" />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-[#F7BCAA] bg-peach-100 px-3.5 py-3 text-xs font-medium text-peach-700">
              {error}
            </div>
          )}
          {infoMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#A8DFCA] bg-mint-100 px-3.5 py-3 text-xs font-medium text-mint-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <div>
                <p className="mb-2 text-xs font-semibold text-plum-900">Choose your role *</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('recruiter')}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      role === 'recruiter'
                        ? 'border-accent bg-lavender-100/75 shadow-sm'
                        : 'border-lavender-200 bg-ivory hover:bg-lavender-50'
                    }`}
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-accent" />
                    <p className="mt-2 text-xs font-bold text-plum-950">I am a Recruiter</p>
                    <p className="mt-0.5 text-[11px] text-plum-600">Post jobs, screen & compare fairly</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('candidate')}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      role === 'candidate'
                        ? 'border-accent bg-babyblue-100/75 shadow-sm'
                        : 'border-lavender-200 bg-ivory hover:bg-lavender-50'
                    }`}
                  >
                    <UserRound className="h-4 w-4 text-babyblue-700" />
                    <p className="mt-2 text-xs font-bold text-plum-950">I am a Candidate</p>
                    <p className="mt-0.5 text-[11px] text-plum-600">Apply, check integrity & grow</p>
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *">
                  <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Priya Nair" required />
                </Field>
                <Field label="Phone (+91)">
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </Field>
              </div>
            )}

            {mode === 'register' && role === 'recruiter' && (
              <Field label="Company / Organization">
                <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Sarvam Technologies" />
              </Field>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <Field label="Email address *">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.in"
                  required
                />
              </Field>
            )}

            {mode === 'reset' && (
              <Field label="Reset token *">
                <input className={inputClass} value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Paste reset token" required />
              </Field>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <Field label={mode === 'reset' ? 'New password *' : 'Password *'} hint={mode === 'register' ? 'Minimum 8 characters.' : undefined}>
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={mode === 'login' ? 1 : 8}
                />
              </Field>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {mode === 'login' && 'Sign in'}
              {mode === 'register' && `Create ${role === 'recruiter' ? 'Recruiter' : 'Candidate'} Account`}
              {mode === 'forgot' && 'Request Password Reset'}
              {mode === 'reset' && 'Update Password'}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-lavender-100 pt-4 text-xs text-plum-700">
            {mode === 'login' ? (
              <>
                <button type="button" onClick={() => { setMode('register'); setError(null); }} className="font-semibold text-accent hover:underline">
                  New to TalentIQ? Create account
                </button>
                <button type="button" onClick={() => { setMode('forgot'); setError(null); }} className="font-medium text-plum-700 hover:text-plum-950 hover:underline">
                  Forgot password?
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMode('login'); setError(null); }} className="font-semibold text-accent hover:underline">
                  Back to sign in
                </button>
                {mode === 'forgot' && (
                  <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="font-medium text-plum-700 hover:text-plum-950 hover:underline">
                    Have a reset token?
                  </button>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
