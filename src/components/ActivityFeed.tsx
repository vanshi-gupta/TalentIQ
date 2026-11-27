import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock } from 'lucide-react';
import type { ActivityItem } from '../types';
import { activityMeta, relativeTime } from '../lib/utils';
import { Badge } from './ui/primitives';

export function ActivityFeed({ items, limit = 6, linked = false }: { items: ActivityItem[]; limit?: number; linked?: boolean }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="h-5 w-5 text-plum-400" />
        <p className="mt-3 text-xs text-plum-600">Activity will appear as hiring progresses.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {items.slice(0, limit).map((item) => {
        const meta = activityMeta[item.type] ?? { label: 'Activity', color: 'text-plum-900 bg-lavender-50 border-lavender-200' };
        const content = (
          <div className="group flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-lavender-50/70">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${meta.color}`}>
              {meta.label.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-5 text-plum-900">{item.message}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-plum-600">{relativeTime(item.created_at)}</span>
                {Boolean(item.is_sample) && <Badge variant="sample" className="px-1.5 py-0 text-[9px]">Demo</Badge>}
              </div>
            </div>
            {linked && (item.candidate_id || item.job_id) && (
              <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-plum-400 transition group-hover:text-plum-950" />
            )}
          </div>
        );
        if (linked && item.candidate_id) return <Link key={item.id} to={`/candidates/${item.candidate_id}`}>{content}</Link>;
        if (linked && item.job_id) return <Link key={item.id} to={`/jobs/${item.job_id}`}>{content}</Link>;
        return <div key={item.id}>{content}</div>;
      })}
    </div>
  );
}
