import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { labelClass } from '../ui/primitives';

export function SkillsInput({
  label = 'Skills',
  hint,
  value,
  onChange,
  placeholder = 'Type a skill and press Enter',
  required,
}: {
  label?: string;
  hint?: string;
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const addSkill = (raw: string) => {
    const candidates = raw.split(',').map((item) => item.trim()).filter(Boolean);
    if (!candidates.length) return;
    const next = [...value];
    for (const candidate of candidates) {
      if (candidate.length > 60) continue;
      if (!next.some((skill) => skill.toLowerCase() === candidate.toLowerCase())) next.push(candidate);
    }
    onChange(next);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill(draft);
    }
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label className={labelClass} htmlFor={`skills-${label.replace(/\s/g, '-')}`}>
        {label}
        {required && <span className="ml-1 text-peach-700">*</span>}
      </label>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-lavender-200 bg-ivory px-3 py-2 transition focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-lavender-200/70">
        {value.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-full border border-lavender-200 bg-lavender-100 px-2.5 py-0.5 text-xs font-medium text-plum-950"
          >
            {skill}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== skill))}
              className="text-plum-600 transition hover:text-peach-700"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={`skills-${label.replace(/\s/g, '-')}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addSkill(draft)}
          placeholder={value.length ? 'Add another…' : placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-0.5 text-sm text-plum-950 outline-none placeholder:text-plum-400"
        />
        <button
          type="button"
          onClick={() => addSkill(draft)}
          className="rounded-lg p-1 text-plum-600 transition hover:bg-lavender-100 hover:text-plum-950"
          aria-label="Add skill"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-plum-600">{hint ?? 'Press Enter or comma to add multiple skills.'}</p>
    </div>
  );
}
