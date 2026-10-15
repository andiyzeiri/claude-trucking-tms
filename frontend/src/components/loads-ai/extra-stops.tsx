'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { useSetAILoadStops, type ExtraStop } from '@/hooks/use-loads-ai-ingestion'

// Dates are wall-clock times stored as if UTC ("2026-10-15T08:00:00Z"):
// read the digits, never convert time zones.
function stopWhen(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(date || '')
  if (!m) return ''
  const day = `${Number(m[2])}/${Number(m[3])}`
  if (!m[4] || (m[4] === '00' && m[5] === '00')) return day
  const h = Number(m[4])
  return `${day} ${h % 12 || 12}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`
}

// "1600 Main St, Joliet, IL 60431, USA" -> "Joliet, IL"; "Amazon MDW2" stays.
function shortPlace(location: string): string {
  const parts = location.split(',').map(p => p.trim()).filter(p => p && p !== 'USA')
  if (parts.length < 2) return location
  const state = parts[parts.length - 1].split(' ')[0]
  return `${parts[parts.length - 2]}, ${state}`
}

/**
 * A load's extra pickups or deliveries, listed in its Pickup / Delivery cell.
 * Clicking × removes that stop (miles are re-routed).
 */
export function ExtraStopsList({ loadId, stops, type }: { loadId: number; stops: ExtraStop[]; type: ExtraStop['type'] }) {
  const setStops = useSetAILoadStops()
  const mine = stops.filter(s => s.type === type)
  if (!mine.length) return null
  const remove = async (stop: ExtraStop) => {
    try {
      await setStops.mutateAsync({ id: loadId, stops: stops.filter(s => s !== stop) })
      toast.success('Stop removed')
    } catch {
      toast.error("Couldn't remove the stop")
    }
  }
  return (
    <div className={type === 'pickup' ? 'mt-1 space-y-0.5' : 'mb-1 space-y-0.5'}>
      {mine.map((s, i) => (
        <div
          key={`${s.location}-${i}`}
          className="group flex items-center gap-1.5 rounded px-1 text-[12px] leading-[17px]"
          style={{ background: '#f5f3ff' }}
          title={[s.name, s.location, s.appointment && `Appt# ${s.appointment}`].filter(Boolean).join('\n')}
        >
          <span className="font-semibold" style={{ color: '#7c3aed' }}>{type === 'pickup' ? 'PU' : 'Stop'} {i + 2}</span>
          <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--monday-text-primary)' }}>{shortPlace(s.location)}</span>
          <span className="whitespace-nowrap" style={{ color: 'var(--monday-text-muted)' }}>{stopWhen(s.date)}</span>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
            title="Remove stop"
            onClick={(e) => { e.stopPropagation(); remove(s) }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * Right-click > Add pickup / delivery stop. A plain overlay rather than a
 * Radix dialog, so Google's address suggestions (attached to <body>) stay
 * clickable.
 */
export function AddStopDialog({ target, onClose }: {
  target: { loadId: number; label: string; type: ExtraStop['type']; stops: ExtraStop[] } | null
  onClose: () => void
}) {
  const setStops = useSetAILoadStops()
  const [location, setLocation] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    setLocation(''); setName(''); setDate(''); setTime('')
  }, [target])

  if (!target) return null
  const kind = target.type === 'pickup' ? 'pickup' : 'delivery'

  const save = async () => {
    if (!location.trim()) return
    const stop: ExtraStop = {
      type: target.type,
      location: location.trim(),
      date: date ? `${date}T${time || '00:00'}:00.000Z` : null,
      name: name.trim() || null,
    }
    try {
      await setStops.mutateAsync({ id: target.loadId, stops: [...target.stops, stop] })
      toast.success(`Added ${kind} stop`)
      onClose()
    } catch {
      toast.error(`Couldn't add the ${kind} stop`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Add {kind} stop{target.label ? ` - Load ${target.label}` : ''}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-gray-500">{target.type === 'pickup' ? 'Shipper' : 'Receiver'} (optional)</div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <div className="mb-1 text-gray-500">Address</div>
            <AddressAutocomplete
              value={location}
              onChange={d => setLocation(d.formatted_address)}
              placeholder="Search address, then pick a suggestion"
              className="h-9 w-full rounded border px-3 text-sm"
            />
            {location && <div className="mt-1 text-xs text-green-700">{location}</div>}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-gray-500">Date</div>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="w-32">
              <div className="mb-1 text-gray-500">Time</div>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {target.type === 'pickup'
              ? 'Picked up after the first pickup. Miles are re-routed through every stop.'
              : 'Delivered before the final delivery. Miles are re-routed through every stop.'}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!location.trim() || setStops.isPending}>
            {setStops.isPending ? 'Adding…' : 'Add stop'}
          </Button>
        </div>
      </div>
    </div>
  )
}
