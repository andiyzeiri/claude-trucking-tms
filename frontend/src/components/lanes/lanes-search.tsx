'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export interface LaneLoad {
  source: 'load' | 'ai'
  id: number
  load_number: string | null
  broker: string | null
  pickup_date: string | null
  pickup_location: string | null
  delivery_location: string | null
  miles: number | null
  rate: string | null
}

export interface LaneRun {
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  load_list: LaneLoad[]
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

interface Place { city?: string; state?: string; zip?: string; lat?: number | null; lng?: number | null }

// Where a typed city / state / ZIP is, for the DH radius (looked up once typing pauses).
function usePlace(query: string, enabled: boolean) {
  const [q, setQ] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])
  return useQuery({
    queryKey: ['lane-place', q],
    queryFn: async (): Promise<Place> => (await api.get('/v1/lanes/place', { params: { q } })).data,
    enabled: enabled && q.length > 1,
    staleTime: Infinity,
  })
}

// Straight-line miles - what a deadhead radius means on a load board.
function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

type EndFilter = { match: (city: string, state: string, lat: number | null, lng: number | null) => number | boolean; note?: string }

// One end of the search: within DH miles of a place, else a city / state name match.
function endFilter(query: string, dh: string, place: Place | undefined, placeLoading: boolean): EndFilter {
  const radius = parseFloat(dh)
  if (!query.trim()) return { match: () => true }
  if (!isNaN(radius) && radius > 0) {
    if (place?.lat != null && place?.lng != null) {
      const { lat, lng } = place as { lat: number; lng: number }
      return {
        match: (_c, _s, la, ln) => {
          if (la == null || ln == null) return false
          const d = milesBetween(lat, lng, la, ln)
          return d <= radius ? d : false
        },
      }
    }
    if (place?.state && !place.city) {
      return { match: (_c, s) => s === place.state, note: 'DH needs a city or ZIP - showing the whole state.' }
    }
    if (place && !placeLoading) {
      return { match: (c, s) => placeMatches(query, c, s), note: `Couldn't find "${query}" on the map - add the state, e.g. "Chicago, IL".` }
    }
  }
  return { match: (c, s) => placeMatches(query, c, s) }
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
  const [fromDh, setFromDh] = useState('')
  const [toDh, setToDh] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const fromPlace = usePlace(from, parseFloat(fromDh) > 0)
  const toPlace = usePlace(to, parseFloat(toDh) > 0)

  const lanes = data || []
  const fromF = endFilter(from, fromDh, fromPlace.data, fromPlace.isFetching)
  const toF = endFilter(to, toDh, toPlace.data, toPlace.isFetching)
  const results = useMemo(() => {
    const out: { lane: LaneRun; fromDh: number | null; toDh: number | null }[] = []
    for (const l of lanes) {
      const a = fromF.match(l.origin_city, l.origin_state, l.origin_lat, l.origin_lng)
      if (a === false) continue
      const b = toF.match(l.destination_city, l.destination_state, l.destination_lat, l.destination_lng)
      if (b === false) continue
      out.push({ lane: l, fromDh: typeof a === 'number' ? a : null, toDh: typeof b === 'number' ? b : null })
    }
    // Closest first when searching by DH, else busiest first (server order).
    if (out.some(r => r.fromDh != null || r.toDh != null)) {
      out.sort((x, y) => ((x.fromDh ?? 0) + (x.toDh ?? 0)) - ((y.fromDh ?? 0) + (y.toDh ?? 0)))
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, from, to, fromDh, toDh, fromPlace.data, toPlace.data, fromPlace.isFetching, toPlace.isFetching])
  const searching = !!(from || to || fromDh || toDh)
  const showFromDh = results.some(r => r.fromDh != null)
  const showToDh = results.some(r => r.toDh != null)
  const loadCount = results.reduce((n, r) => n + r.lane.loads, 0)
  const notes = [fromF.note && `From: ${fromF.note}`, toF.note && `To: ${toF.note}`].filter(Boolean)
  const keyOf = (l: LaneRun) => `${l.origin_city}|${l.origin_state}|${l.destination_city}|${l.destination_state}`
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const colCount = 7 + (showFromDh ? 1 : 0) + (showToDh ? 1 : 0)

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
        {([
          ['From', from, setFrom, fromDh, setFromDh, 'Chicago, IL'],
          ['To', to, setTo, toDh, setToDh, 'OH'],
        ] as const).map(([label, value, setValue, dh, setDh, hint]) => (
          <div key={label} className="flex items-end gap-1.5">
            <label className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
              {label} (city, state or ZIP)
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--monday-text-muted)' }} />
                <input className="rounded border py-1.5 pl-7 pr-2" style={{ ...inputStyle, width: '200px' }} placeholder={hint} value={value} onChange={e => setValue(e.target.value)} />
              </div>
            </label>
            <label className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }} title="Deadhead: search this many miles around the city">
              DH
              <input type="number" min={0} className="rounded border px-2 py-1.5" style={{ ...inputStyle, width: '70px' }} placeholder="mi" value={dh} onChange={e => setDh(e.target.value)} />
            </label>
          </div>
        ))}
        {searching && (
          <button
            onClick={() => { setFrom(''); setTo(''); setFromDh(''); setToDh('') }}
            className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-gray-100"
            style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <span className="ml-auto" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>
          {isLoading ? 'Loading lanes…' : `${loadCount} load${loadCount === 1 ? '' : 's'} on ${results.length} of ${lanes.length} lanes · last 12 months`}
        </span>
      </div>
      {notes.map(n => (
        <div key={n} className="rounded px-3 py-2" style={{ fontSize: '12px', backgroundColor: 'rgba(253, 171, 61, 0.15)', color: 'var(--monday-text-primary)' }}>{n}</div>
      ))}

      {/* Results */}
      <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <tr>
              {th('From')}
              {showFromDh && th('DH', true)}
              {th('To')}
              {showToDh && th('DH', true)}
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
                <td colSpan={colCount} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                  {lanes.length ? 'No lanes match this search.' : 'No lanes yet - they come from your loads.'}
                </td>
              </tr>
            )}
            {results.map(({ lane: l, fromDh: fd, toDh: tdh }) => {
              const k = keyOf(l)
              const isOpen = open.has(k)
              return (
                <React.Fragment key={k}>
                  <tr className="cursor-pointer hover:bg-gray-50" onClick={() => toggle(k)}>
                    {td(<span className="flex items-center gap-1">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l.origin_city}, {l.origin_state}</span>)}
                    {showFromDh && td(fd != null ? `${Math.round(fd)} mi` : '-', true, true)}
                    {td(`${l.destination_city}, ${l.destination_state}`)}
                    {showToDh && td(tdh != null ? `${Math.round(tdh)} mi` : '-', true, true)}
                    {td(l.miles != null ? l.miles.toLocaleString() : '-', true)}
                    {td(l.loads, true)}
                    {td(l.last_run ? new Date(`${l.last_run}T12:00:00`).toLocaleDateString() : '-', false, true)}
                    {td(l.avg_rate ? formatCurrency(Number(l.avg_rate)) : '-', true)}
                    {td(l.avg_rpm ? `$${Number(l.avg_rpm).toFixed(2)}` : '-', true, true)}
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={colCount} className="border-b px-6 py-2" style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}>
                        <table className="w-full" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr style={{ color: 'var(--monday-text-secondary)' }}>
                              <th className="py-1 text-left font-medium">Pickup</th>
                              <th className="py-1 text-left font-medium">Load #</th>
                              <th className="py-1 text-left font-medium">Broker</th>
                              <th className="py-1 text-left font-medium">From</th>
                              <th className="py-1 text-left font-medium">To</th>
                              <th className="py-1 text-right font-medium">Miles</th>
                              <th className="py-1 text-right font-medium">Rate</th>
                              <th className="py-1 text-left font-medium pl-3">Page</th>
                            </tr>
                          </thead>
                          <tbody>
                            {l.load_list.map(x => (
                              <tr key={`${x.source}-${x.id}`} style={{ color: 'var(--monday-text-primary)' }}>
                                <td className="py-1">{x.pickup_date ? new Date(`${x.pickup_date}T12:00:00`).toLocaleDateString() : '-'}</td>
                                <td className="py-1">{x.load_number || '-'}</td>
                                <td className="py-1">{x.broker || '-'}</td>
                                <td className="py-1">{x.pickup_location || '-'}</td>
                                <td className="py-1">{x.delivery_location || '-'}</td>
                                <td className="py-1 text-right">{x.miles != null ? x.miles.toLocaleString() : '-'}</td>
                                <td className="py-1 text-right">{x.rate ? formatCurrency(Number(x.rate)) : '-'}</td>
                                <td className="py-1 pl-3" style={{ color: 'var(--monday-text-secondary)' }}>{x.source === 'ai' ? 'Loads AI' : 'Loads'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
