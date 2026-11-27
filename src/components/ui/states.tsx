import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from './primitives';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-plum-700">
      <div className="rounded-2xl border border-lavender-200 bg-lavender-50 p-3">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-[#F7BCAA] bg-peach-100/60 px-6 py-12 text-center">
      <div className="rounded-2xl border border-[#F7BCAA] bg-white p-3">
        <AlertCircle className="h-6 w-6 text-peach-700" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-plum-950">Unable to load this section</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-plum-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-lavender-200 bg-ivory px-6 py-12 text-center ${className ?? ''}`}>
      <div className="rounded-2xl border border-lavender-200 bg-lavender-100/70 p-3">
        <Icon className="h-6 w-6 text-accent" />
      </div>
      <h3 className="mt-4 font-display text-sm font-semibold text-plum-950">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-xs leading-5 text-plum-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-lavender-100 ${className ?? ''}`} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-28" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}
