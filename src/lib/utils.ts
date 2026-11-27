export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatInr(rupees: number | null | undefined): string {
  if (rupees === null || rupees === undefined || !Number.isFinite(rupees)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatSalaryRangeInr(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Compensation negotiable';
  const toLpa = (val: number) => `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)} LPA`;
  if (min && max && max > min) return `${toLpa(min)} – ${toLpa(max)}`;
  if (min) return `${toLpa(min)}+`;
  if (max) return `Up to ${toLpa(max)}`;
  return 'Compensation negotiable';
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(value);
}

export function experienceRange(min: number, max: number, short = false): string {
  const unit = short ? 'yrs' : 'years';
  if (!min && !max) return 'Any experience';
  if (!min && max > 0) return `Up to ${max} ${unit}`;
  if (max > 0 && max > min) return `${min}–${max} ${unit}`;
  if (max > 0 && max === min) return `${min} ${unit}`;
  return `${min}+ ${unit}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#685489';
  if (score >= 85) return '#236B50';
  if (score >= 70) return '#7D5CE6';
  if (score >= 55) return '#B87B14';
  return '#B94D48';
}

export function matchRecommendation(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'No job match recorded yet.';
  if (score >= 85) return 'Strong match — clear alignment across core qualifications.';
  if (score >= 70) return 'Good match — inspect missing skills & evidence ledger.';
  if (score >= 55) return 'Partial match — review transferable skills before deciding.';
  return 'Low overlap for this specific role — check alternative opportunities.';
}

export function scoreTone(score: number | null | undefined): 'strong' | 'good' | 'review' | 'low' | 'none' {
  if (score === null || score === undefined) return 'none';
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 55) return 'review';
  return 'low';
}

export const stageMeta: Record<string, { label: string; className: string; dot: string }> = {
  new: { label: 'New', className: 'border-[#A7CCF7] bg-[#DCEEFF] text-[#2C598F]', dot: 'bg-[#2C598F]' },
  screening: { label: 'Screening', className: 'border-[#CDBBFF] bg-[#E9DFFF] text-[#34264A]', dot: 'bg-[#7D5CE6]' },
  interview: { label: 'Interview', className: 'border-[#A8DFCA] bg-[#D8F3E8] text-[#236B50]', dot: 'bg-[#236B50]' },
  offer: { label: 'Offer', className: 'border-[#F2D57A] bg-[#FFF1BD] text-[#7A5310]', dot: 'bg-[#B87B14]' },
  hired: { label: 'Hired', className: 'border-[#8AD1B6] bg-[#D8F3E8] text-[#236B50]', dot: 'bg-[#236B50]' },
  rejected: { label: 'Not Selected', className: 'border-[#F7BCAA] bg-[#FFE3D5] text-[#B94D48]', dot: 'bg-[#B94D48]' },
};

export const pipelineStageMeta: Record<string, { label: string; className: string }> = {
  applied: { label: 'Applied', className: 'border-[#A7CCF7] bg-[#DCEEFF] text-[#2C598F]' },
  screening: { label: 'Screening', className: 'border-[#CDBBFF] bg-[#E9DFFF] text-[#34264A]' },
  shortlisted: { label: 'Shortlisted', className: 'border-[#A8DFCA] bg-[#D8F3E8] text-[#236B50]' },
  interview: { label: 'Interview', className: 'border-[#F2D57A] bg-[#FFF1BD] text-[#7A5310]' },
  selected: { label: 'Selected', className: 'border-[#8AD1B6] bg-[#D8F3E8] text-[#236B50]' },
  not_selected: { label: 'Not Selected', className: 'border-[#F7BCAA] bg-[#FFE3D5] text-[#B94D48]' },
};

export const jobStatusMeta: Record<string, { label: string; className: string; dot: string }> = {
  active: { label: 'Active', className: 'border-[#A8DFCA] bg-[#D8F3E8] text-[#236B50]', dot: 'bg-[#236B50]' },
  draft: { label: 'Draft', className: 'border-[#F2D57A] bg-[#FFF1BD] text-[#7A5310]', dot: 'bg-[#B87B14]' },
  paused: { label: 'Paused', className: 'border-[#F7BCAA] bg-[#FFE3D5] text-[#B94D48]', dot: 'bg-[#B94D48]' },
  closed: { label: 'Closed', className: 'border-[#CDBBFF] bg-[#E9DFFF] text-[#534171]', dot: 'bg-[#7D5CE6]' },
};

export const activityMeta: Record<string, { label: string; color: string }> = {
  resume_processed: { label: 'Resume screened', color: 'text-[#2C598F] bg-[#DCEEFF] border-[#A7CCF7]' },
  resume_failed: { label: 'Screening failed', color: 'text-[#B94D48] bg-[#FFE3D5] border-[#F7BCAA]' },
  candidate_created: { label: 'Candidate added', color: 'text-[#34264A] bg-[#E9DFFF] border-[#CDBBFF]' },
  candidate_updated: { label: 'Profile updated', color: 'text-[#2C598F] bg-[#DCEEFF] border-[#A7CCF7]' },
  candidate_deleted: { label: 'Candidate removed', color: 'text-[#534171] bg-[#E9DFFF] border-[#CDBBFF]' },
  stage_changed: { label: 'Pipeline updated', color: 'text-[#236B50] bg-[#D8F3E8] border-[#A8DFCA]' },
  job_created: { label: 'Job added', color: 'text-[#34264A] bg-[#E9DFFF] border-[#CDBBFF]' },
  job_updated: { label: 'Job updated', color: 'text-[#2C598F] bg-[#DCEEFF] border-[#A7CCF7]' },
  job_deleted: { label: 'Job removed', color: 'text-[#534171] bg-[#FFF1BD] border-[#F2D57A]' },
  match_run: { label: 'Job match run', color: 'text-[#34264A] bg-[#E9DFFF] border-[#CDBBFF]' },
  identity_revealed: { label: 'Identity revealed', color: 'text-[#7A5310] bg-[#FFF1BD] border-[#F2D57A]' },
  payment_verified: { label: 'Payment verified', color: 'text-[#236B50] bg-[#D8F3E8] border-[#A8DFCA]' },
  application_submitted: { label: 'New application', color: 'text-[#2C598F] bg-[#DCEEFF] border-[#A7CCF7]' },
  settings_updated: { label: 'Settings updated', color: 'text-[#534171] bg-[#E9DFFF] border-[#CDBBFF]' },
  ai_suggestion: { label: 'AI insight', color: 'text-[#34264A] bg-[#E9DFFF] border-[#CDBBFF]' },
  resume_deleted: { label: 'Resume removed', color: 'text-[#B94D48] bg-[#FFE3D5] border-[#F7BCAA]' },
  demo_removed: { label: 'Demo cleared', color: 'text-[#534171] bg-[#FFF1BD] border-[#F2D57A]' },
};

export function downloadTextFile(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  downloadTextFile(filename, `\uFEFF${toCsv(rows)}`);
}
