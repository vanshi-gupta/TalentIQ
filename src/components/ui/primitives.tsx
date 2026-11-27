import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn, initials, scoreColor, scoreTone } from '../../lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card-surface', className)} {...props}>
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'mint';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white shadow-sm hover:bg-accent-deep active:scale-[0.99]',
    secondary: 'border border-lavender-200 bg-white text-plum-900 hover:bg-lavender-50 hover:border-lavender-300',
    ghost: 'text-plum-700 hover:bg-lavender-50 hover:text-plum-950',
    danger: 'border border-[#F7BCAA] bg-peach-100 text-peach-700 hover:bg-peach-200',
    outline: 'border border-lavender-200 bg-lavender-50 text-plum-900 hover:bg-lavender-100',
    mint: 'border border-[#A8DFCA] bg-mint-100 text-mint-700 hover:bg-mint-200',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-5 text-sm',
    icon: 'h-9 w-9 p-0',
  };
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Badge({
  children,
  variant = 'default',
  className,
  dot,
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'sample' | 'outline' | 'violet';
  className?: string;
  dot?: boolean;
}) {
  const variants = {
    default: 'border-lavender-100 bg-lavender-50 text-plum-900',
    success: 'border-[#A8DFCA] bg-mint-100 text-mint-700',
    warning: 'border-[#F2D57A] bg-butter-100 text-butter-700',
    danger: 'border-[#F7BCAA] bg-peach-100 text-peach-700',
    info: 'border-[#A7CCF7] bg-babyblue-100 text-babyblue-700',
    sample: 'border-dashed border-[#F2D57A] bg-butter-100 text-butter-700',
    outline: 'border-lavender-200 bg-white text-plum-700',
    violet: 'border-lavender-200 bg-lavender-100 text-plum-950',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        variants[variant],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return <Badge variant="sample" className={className}>Demo data</Badge>;
}

const AVATAR_TONES = [
  'bg-lavender-100 text-plum-950 border-lavender-200',
  'bg-mint-100 text-mint-700 border-[#A8DFCA]',
  'bg-babyblue-100 text-babyblue-700 border-[#A7CCF7]',
  'bg-peach-100 text-peach-700 border-[#F7BCAA]',
  'bg-butter-100 text-butter-700 border-[#F2D57A]',
];

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const value = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tone = AVATAR_TONES[value % AVATAR_TONES.length];
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-12 w-12 text-sm', xl: 'h-16 w-16 text-lg' };
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border font-display font-bold tracking-wide',
        tone,
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

export function ScoreRing({ score, size = 64, stroke = 5, className }: { score: number | null | undefined; size?: number; stroke?: number; className?: string }) {
  const value = score ?? 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E9DFFF" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display font-bold text-plum-950', size > 70 ? 'text-lg' : 'text-sm')}>
          {score === null || score === undefined ? '—' : `${Math.round(score)}%`}
        </span>
      </div>
    </div>
  );
}

export function ScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = scoreTone(score);
  const tones = {
    strong: 'border-[#A8DFCA] bg-mint-100 text-mint-700',
    good: 'border-lavender-200 bg-lavender-100 text-plum-950',
    review: 'border-[#F2D57A] bg-butter-100 text-butter-700',
    low: 'border-[#F7BCAA] bg-peach-100 text-peach-700',
    none: 'border-lavender-100 bg-lavender-50 text-plum-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums', tones[tone], className)}>
      {score === null || score === undefined ? '—' : `${Math.round(score)}%`}
    </span>
  );
}

export function ProgressBar({
  value,
  color,
  className,
  height = 'h-2',
}: {
  value: number;
  color?: string;
  className?: string;
  height?: string;
}) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-lavender-100', height, className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', !color && 'bg-accent')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  );
}

export function SkillPill({ children, muted, className }: { children: ReactNode; muted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        muted
          ? 'border-[#F7BCAA] bg-peach-100/70 text-peach-700'
          : 'border-lavender-200 bg-lavender-50 text-plum-900',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = 'violet',
  loading,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  accent?: 'violet' | 'cyan' | 'emerald' | 'amber';
  loading?: boolean;
}) {
  const accents = {
    violet: { bg: 'bg-lavender-100 border-lavender-200', text: 'text-accent' },
    cyan: { bg: 'bg-babyblue-100 border-[#A7CCF7]', text: 'text-babyblue-700' },
    emerald: { bg: 'bg-mint-100 border-[#A8DFCA]', text: 'text-mint-700' },
    amber: { bg: 'bg-butter-100 border-[#F2D57A]', text: 'text-butter-700' },
  };
  const style = accents[accent];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-plum-700">{label}</p>
          {loading ? (
            <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-lavender-100" />
          ) : (
            <p className="mt-2 font-display text-[28px] font-bold leading-none tracking-tight text-plum-950">{value}</p>
          )}
          {detail && <div className="mt-3 text-xs leading-5 text-plum-600">{detail}</div>}
        </div>
        <div className={cn('rounded-xl border p-2.5', style.bg)}>
          <Icon className={cn('h-5 w-5', style.text)} />
        </div>
      </div>
    </Card>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-xl border border-lavender-200 bg-lavender-50 p-2">
            <Icon className="h-4 w-4 text-accent" />
          </div>
        )}
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-plum-950">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-plum-600">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-lavender-100', className)} />;
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender-500/60 disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-lavender-200 bg-lavender-100',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

export function AIBadge({ className, label = 'AI Insight' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-lavender-200 bg-lavender-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-plum-950', className)}>
      <Sparkles className="h-3 w-3 text-accent" />
      {label}
    </span>
  );
}

export function DeterministicBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-[#A7CCF7] bg-babyblue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-babyblue-700', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-babyblue-700" />
      Deterministic Match
    </span>
  );
}

export const inputClass =
  'h-10 w-full rounded-xl border border-lavender-200 bg-ivory px-3.5 text-sm text-plum-950 outline-none transition placeholder:text-plum-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-lavender-200/70 disabled:cursor-not-allowed disabled:opacity-60';

export const textareaClass =
  'w-full rounded-xl border border-lavender-200 bg-ivory px-3.5 py-2.5 text-sm leading-6 text-plum-950 outline-none transition placeholder:text-plum-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-lavender-200/70 disabled:cursor-not-allowed disabled:opacity-60';

export const labelClass = 'mb-1.5 block text-xs font-semibold text-plum-900';

export function Field({ label, hint, error, children, htmlFor, className }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <label className={labelClass} htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-peach-700">{error}</p> : hint ? <p className="mt-1.5 text-[11px] leading-4 text-plum-600">{hint}</p> : null}
    </div>
  );
}
