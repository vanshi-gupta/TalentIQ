import { Sparkles, X } from 'lucide-react';
import type { AiSuggestion } from '../types';
import { AIBadge } from './ui/primitives';
import { formatDateTime } from '../lib/utils';

export function AIResultPanel({ result, onDismiss }: { result: AiSuggestion; onDismiss?: () => void }) {
  const isFallback = result.provider === 'local-fallback';
  return (
    <div className="ai-panel relative rounded-2xl border p-5 shadow-card">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-plum-600 transition hover:bg-lavender-100 hover:text-plum-950"
          aria-label="Dismiss AI result"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2.5 pr-8">
        <div className="rounded-lg border border-lavender-200 bg-white p-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        </div>
        <AIBadge label={isFallback ? 'Deterministic Local Assistant' : 'AI Insight (Gemini)'} />
        <span className="text-[11px] text-plum-600">{result.model} · {formatDateTime(result.generatedAt)}</span>
      </div>
      <div className="mt-4 whitespace-pre-wrap text-[13px] leading-6 text-plum-900">{result.suggestion}</div>
      <div className="mt-4 rounded-xl border border-lavender-100 bg-white/80 px-3.5 py-2.5 text-[11px] leading-4 text-plum-600">
        {result.disclaimer}
      </div>
    </div>
  );
}
