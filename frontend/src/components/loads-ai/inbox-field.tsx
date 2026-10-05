'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface InboxFieldProps {
  id: string
  label: string
  /** What arrives in this inbox and what Loads AI does with it. */
  description: string
  icon: React.ReactNode
  /** Saved address (from the server); null when not set. */
  value: string | null
  loading?: boolean
  saving?: boolean
  onSave: (value: string | null) => Promise<unknown>
  /** Connected and being read, or the reason it isn't. */
  status: { ok: boolean; text: string } | null
  placeholder: string
}

/**
 * One Loads AI inbox: its address plus whether it is actually being read.
 * The address is the opt-in - an inbox is only read once it's named here
 * and its App Password is stored on the server.
 */
export function InboxField({ id, label, description, icon, value, loading, saving, onSave, status, placeholder }: InboxFieldProps) {
  const [draft, setDraft] = useState('')
  // Don't overwrite what the user is typing when the query refetches.
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!touched) setDraft(value ?? '')
  }, [value, touched])

  const dirty = draft.trim() !== (value ?? '')

  const save = async () => {
    try {
      await onSave(draft.trim() || null)
      setTouched(false)
    } catch {
      // The hook shows the error; keep the draft so it can be fixed.
    }
  }

  return (
    <div
      className="rounded-lg border p-3 md:p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--monday-bg-primary)', borderColor: 'var(--monday-border-light)' }}
    >
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--monday-text-primary)' }}>
        {icon}
        {label}
      </label>
      <p className="text-xs" style={{ color: 'var(--monday-text-secondary)' }}>{description}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          placeholder={loading ? 'Loading…' : placeholder}
          disabled={loading || saving}
          value={draft}
          onChange={(e) => { setTouched(true); setDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !saving) save() }}
          className="w-full"
          style={{ backgroundColor: 'var(--monday-bg-primary)', borderColor: 'var(--monday-border-light)' }}
        />
        <Button onClick={save} disabled={!dirty || loading || saving} className="sm:w-24 shrink-0">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {status && (
        <p className={`flex items-start gap-1.5 text-xs ${status.ok ? 'text-green-700' : 'text-amber-700'}`}>
          {status.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />}
          <span>{status.text}</span>
        </p>
      )}
    </div>
  )
}
