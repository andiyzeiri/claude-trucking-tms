'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export interface LaneRun {
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  miles: number | null
  loads: number
  last_run: string | null
  avg_rate: string | null
  avg_rpm: string | null
}

function useLaneHistory() {
  return useQuery({
    queryKey: ['lane-history'],
    queryFn: async (): Promise<LaneRun[]> => (await api.get('/v1/lanes/history')).data,
  })
}

// "chicago", "IL", "chicago il" or "chicago, il" against one end of a lane
function placeMatches(query: string, city: string, state: string) {
  const words = query.toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const c = city.toLowerCase()
  const st = state.toLowerCase()
  const last = words[words.length - 1]
  if (words.length > 1 && last.length === 2 && last === st) {
    return c.startsWith(words.slice(0, -1).join(' '))
  }
  const q = words.join(' ')
  return q.length === 2 ? st === q || c.startsWith(q) : c.startsWith(q)
}

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--monday-border)',
  fontSize: '13px',
  backgroundColor: 'var(--monday-bg-primary)',
  color: 'var(--monday-text-primary)',
}

export function LanesSearch() {
  const { data, isLoading } = useLaneHistory()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [minMiles, setMinMiles] = useState('')
  const [maxMiles, setMaxMiles] = useState('')

  const lanes = data || []
  const results = useMemo(() => {
    const lo = parseFloat(minMiles)
    const hi = parseFloat(maxMiles)
    return lanes.filter(l =>
      placeMatches(from, l.origin_city, l.origin_state) &&
      placeMatches(to, l.destination_city, l.destination_state) &&
      (isNaN(lo) || (l.miles ?? -1) >= lo) &&
      (isNaN(hi) || (l.miles != null && l.miles <= hi))
    )
  }, [lanes, from, to, minMiles, maxMiles])
  const searching = !!(from || to || minMiles || maxMiles)

  const th = (label: string, right = false) => (
    <th className={`px-3 py-2.5 ${right ? 'text-right' : 'text-left'} border-b`} style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>{label}</th>
  )
  const td = (content: React.ReactNode, right = false, muted = false) => (
    <td className={`px-3 py-2.5 border-b ${right ? 'text-right' : ''}`} style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: muted ? 'var(--monday-text-secondary)' : 'var(--monday-text-primary)' }}>{content}</td>
  )

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg p-3" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}>
        <label className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          From (city or state)
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--monday-text-muted)' }} />
            <input className="rounded border py-1.5 pl-7 pr-2" style={{ ...inputStyle, width: '200px' }} placeholder="Chicago, IL" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          To (city or state)
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--monday-text-muted)' }} />
            <input className="rounded border py-1.5 pl-7 pr-2" style={{ ...inputStyle, width: '200px' }} placeholder="OH" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          Miles
          <div className="flex items-center gap-1.5">
            <input type="number" min={0} className="rounded border px-2 py-1.5" style={{ ...inputStyle, width: '90px' }} placeholder="Min" value={minMiles} onChange={e => setMinMiles(e.target.value)} />
            <span>–</span>
            <input type="number" min={0} className="rounded border px-2 py-1.5" style={{ ...inputStyle, width: '90px' }} placeholder="Max" value={maxMiles} onChange={e => setMaxMiles(e.target.value)} />
          </div>
        </label>
        {searching && (
          <button
            onClick={() => { setFrom(''); setTo(''); setMinMiles(''); setMaxMiles('') }}
            className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-gray-100"
            style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <span className="ml-auto" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>
          {isLoading ? 'Loading lanes…' : `${results.length} of ${lanes.length} lanes · last 12 months of loads`}
        </span>
      </div>

      {/* Results */}
      <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <tr>
              {th('From')}
              {th('To')}
              {th('Miles', true)}
              {th('Loads', true)}
              {th('Last run')}
              {th('Avg rate', true)}
              {th('Avg $/mi', true)}
            </tr>
          </thead>
          <tbody>
            {!isLoading && results.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                  {lanes.length ? 'No lanes match this search.' : 'No lanes yet - they come from your loads.'}
                </td>
              </tr>
            )}
            {results.map(l => (
              <tr key={`${l.origin_city}|${l.origin_state}|${l.destination_city}|${l.destination_state}`}>
                {td(`${l.origin_city}, ${l.origin_state}`)}
                {td(`${l.destination_city}, ${l.destination_state}`)}
                {td(l.miles != null ? l.miles.toLocaleString() : '-', true)}
                {td(l.loads, true)}
                {td(l.last_run ? new Date(`${l.last_run}T12:00:00`).toLocaleDateString() : '-', false, true)}
                {td(l.avg_rate ? formatCurrency(Number(l.avg_rate)) : '-', true)}
                {td(l.avg_rpm ? `$${Number(l.avg_rpm).toFixed(2)}` : '-', true, true)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
