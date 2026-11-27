import { useState } from 'react'
import { X } from 'lucide-react'

// Simple tag editor: Enter or comma adds a tag, backspace on empty removes the last one.
export default function TagInput({ value, onChange, placeholder = 'Type and press Enter', tone = 'blue' }) {
  const [text, setText] = useState('')
  const add = (raw) => {
    const t = raw.trim()
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setText('')
  }
  const color = tone === 'purple' ? 'border-brand-purple/30 bg-brand-purple/10 text-violet-200' : 'border-brand-blue/30 bg-brand-blue/10 text-sky-200'
  return (
    <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-xl border border-white/10 bg-ink-900/80 p-1.5 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/30">
      {value.map((v) => (
        <span key={v} className={`chip gap-1 ${color}`}>{v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button></span>
      ))}
      <input className="min-w-[8rem] flex-1 bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder-slate-500"
        value={text} placeholder={value.length ? '' : placeholder}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(text) }
          if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => text && add(text)} />
    </div>
  )
}
