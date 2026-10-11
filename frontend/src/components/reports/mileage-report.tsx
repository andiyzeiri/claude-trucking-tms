'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Download, Gauge, Loader2, AlertTriangle } from 'lucide-react'
import {
  useEldConnection, useEldMileage, useEldStateMiles, useSetEldTruckMatch, VehicleMiles,
} from '@/hooks/use-eld'

// Reports > Mileage: miles driven per truck and per state, read from Peak ELD.

type Preset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'last_quarter', label: 'Last quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtMiles = (n: number) => Math.round(n).toLocaleString()
const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** [start, end] for a preset; weeks run Monday-Sunday like Payroll. */
function presetRange(p: Preset, today = new Date()): [string, string] {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1 // Monday = 0
  const q = Math.floor(m / 3)
  switch (p) {
    case 'last_week': return [ymd(new Date(y, m, d - dow - 7)), ymd(new Date(y, m, d - dow - 1))]
    case 'this_month': return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))]
    case 'last_month': return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))]
    case 'this_quarter': return [ymd(new Date(y, q * 3, 1)), ymd(new Date(y, q * 3 + 3, 0))]
    case 'last_quarter': return [ymd(new Date(y, q * 3 - 3, 1)), ymd(new Date(y, q * 3, 0))]
    case 'this_year': return [ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31))]
    default: return [ymd(new Date(y, m, d - dow)), ymd(new Date(y, m, d - dow + 6))]
  }
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function MileageReport() {
  const { data: conn, isLoading: connLoading } = useEldConnection()
  const [preset, setPreset] = useState<Preset>('this_week')
  const [custom, setCustom] = useState<[string, string]>(() => presetRange('this_week'))
  const [view, setView] = useState<'trucks' | 'states'>('trucks')
  const [showIdle, setShowIdle] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const [start, end] = preset === 'custom' ? custom : presetRange(preset)
  const connected = !!conn?.connected
  // Odometer (first to last inspection) costs a few Peak calls per truck, so only for a month or less.
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000 + 1
  const withOdometer = days <= 31
  const trucksQ = useEldMileage(start, end, connected, withOdometer)
  // Per-state miles cost one Peak call per truck, so only load them when asked for.
  const statesQ = useEldStateMiles(start, end, connected && (view === 'states' || open.size > 0))
  const setMatch = useSetEldTruckMatch()

  const vehicles = useMemo(
    () => (trucksQ.data?.vehicles ?? []).filter(v => showIdle || v.miles > 0),
    [trucksQ.data, showIdle],
  )
  const idleCount = (trucksQ.data?.vehicles.length ?? 0) - (trucksQ.data?.vehicles.filter(v => v.miles > 0).length ?? 0)
  const unmatched = (trucksQ.data?.vehicles ?? []).filter(v => v.miles > 0 && !v.truck_id).length

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const exportCsv = () => {
    if (view === 'states' && statesQ.data) {
      const units = Object.fromEntries((trucksQ.data?.vehicles ?? []).map(v => [v.eld_id, v]))
      const rows: (string | number)[][] = [['State', 'Miles']]
      statesQ.data.states.forEach(s => rows.push([s.state, s.miles]))
      rows.push(['Total', statesQ.data.total_miles], [], ['Truck', 'Peak unit', 'State', 'Miles'])
      Object.entries(statesQ.data.by_vehicle).forEach(([id, states]) =>
        states.forEach(s => rows.push([units[id]?.truck_number ?? '', units[id]?.unit ?? id, s.state, s.miles])))
      downloadCsv(`state-miles-${start}-to-${end}.csv`, rows)
    } else if (trucksQ.data) {
      const rows: (string | number)[][] = [['Truck', 'Peak unit', 'VIN', 'Driver', 'Start odometer', 'End odometer', 'Odometer miles', 'GPS miles']]
      vehicles.forEach(v => rows.push([
        v.truck_number ?? '', v.unit, v.vin ?? '', v.driver_name ?? '',
        v.start_odometer ?? '', v.end_odometer ?? '', v.odometer_miles ?? '', v.miles,
      ]))
      rows.push(['Total', '', '', '', '', '', '', trucksQ.data.total_miles])
      downloadCsv(`truck-miles-${start}-to-${end}.csv`, rows)
    }
  }

  if (connLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  if (!connected) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
        <Gauge className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-medium text-gray-900">Connect Peak ELD to see truck miles</h3>
        <p className="text-sm text-gray-500 mt-1">Add your Peak ELD API key under Settings → ELD Integration.</p>
        <Link href="/settings">
          <Button className="mt-4 bg-brand hover:bg-brand/90">Go to Settings</Button>
        </Link>
      </div>
    )
  }

  const error = (view === 'states' ? statesQ.error : trucksQ.error) as any
  const loading = view === 'states' ? statesQ.isLoading : trucksQ.isLoading

  return (
    <div className="space-y-4">
      {/* Period + view */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => {
                if (p.key === 'custom') setCustom([start, end])
                setPreset(p.key)
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                preset === p.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={custom[0]} max={custom[1]} onChange={e => e.target.value && setCustom([e.target.value, custom[1]])}
              className="border border-gray-300 rounded-md px-2 py-1.5" />
            <span className="text-gray-500">to</span>
            <input type="date" value={custom[1]} min={custom[0]} onChange={e => e.target.value && setCustom([custom[0], e.target.value])}
              className="border border-gray-300 rounded-md px-2 py-1.5" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex gap-1">
            {(['trucks', 'states'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${view === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {v === 'trucks' ? 'By truck' : 'By state'}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={loading || !!error}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-600">Total miles</div>
          <div className="text-3xl font-bold text-brand">
            {trucksQ.data ? fmtMiles(trucksQ.data.total_miles) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">{fmtDate(start)} – {fmtDate(end)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-600">Trucks that drove</div>
          <div className="text-3xl font-bold text-gray-900">
            {trucksQ.data ? trucksQ.data.vehicles.filter(v => v.miles > 0).length : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-600">{view === 'states' ? 'States driven' : 'Avg miles per truck'}</div>
          <div className="text-3xl font-bold text-gray-900">
            {view === 'states'
              ? (statesQ.data ? statesQ.data.states.filter(s => s.miles > 0).length : '—')
              : trucksQ.data && trucksQ.data.vehicles.some(v => v.miles > 0)
                ? fmtMiles(trucksQ.data.total_miles / trucksQ.data.vehicles.filter(v => v.miles > 0).length)
                : '—'}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error?.response?.data?.detail?.toString?.() || 'Could not load miles from Peak ELD'}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : view === 'trucks' && trucksQ.data ? (
        <>
          {unmatched > 0 && (
            <p className="text-sm text-amber-700">
              {unmatched} Peak {unmatched === 1 ? 'truck isn’t' : 'trucks aren’t'} matched to a truck here — pick one in the Truck column.
            </p>
          )}
          <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="w-8" />
                  <th className="text-left font-medium px-4 py-3">Truck</th>
                  <th className="text-left font-medium px-4 py-3">Peak unit</th>
                  <th className="text-left font-medium px-4 py-3">Driver</th>
                  {withOdometer && <th className="text-right font-medium px-4 py-3">Odometer miles</th>}
                  <th className="text-right font-medium px-4 py-3">GPS miles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.length === 0 && (
                  <tr><td colSpan={withOdometer ? 6 : 5} className="px-4 py-8 text-center text-gray-500">No miles in this period</td></tr>
                )}
                {vehicles.map(v => (
                  <TruckRow
                    key={v.eld_id}
                    v={v}
                    trucks={trucksQ.data!.trucks}
                    withOdometer={withOdometer}
                    open={open.has(v.eld_id)}
                    onToggle={() => toggle(v.eld_id)}
                    states={statesQ.data?.by_vehicle[v.eld_id]}
                    statesLoading={statesQ.isLoading}
                    onMatch={truck_id => setMatch.mutate({ eld_id: v.eld_id, truck_id })}
                  />
                ))}
              </tbody>
              {vehicles.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td />
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    {withOdometer && (
                      <td className="px-4 py-3 text-right">
                        {fmtMiles(trucksQ.data.vehicles.reduce((sum, v) => sum + (v.odometer_miles ?? 0), 0))}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">{fmtMiles(trucksQ.data.total_miles)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {idleCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={showIdle} onChange={e => setShowIdle(e.target.checked)} />
              Show {idleCount} {idleCount === 1 ? 'truck' : 'trucks'} with no miles
            </label>
          )}
        </>
      ) : view === 'states' && statesQ.data ? (
        <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto max-w-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-medium px-4 py-3">State</th>
                <th className="text-right font-medium px-4 py-3">Miles</th>
                <th className="text-right font-medium px-4 py-3">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statesQ.data.states.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No miles in this period</td></tr>
              )}
              {statesQ.data.states.map(s => (
                <tr key={s.state}>
                  <td className="px-4 py-2.5 font-medium">{s.state}</td>
                  <td className="px-4 py-2.5 text-right">{fmtMiles(s.miles)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">
                    {statesQ.data!.total_miles ? `${((s.miles / statesQ.data!.total_miles) * 100).toFixed(1)}%` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            {statesQ.data.states.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{fmtMiles(statesQ.data.total_miles)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : null}
    </div>
  )
}

function TruckRow({ v, trucks, withOdometer, open, onToggle, states, statesLoading, onMatch }: {
  v: VehicleMiles
  withOdometer: boolean
  trucks: { id: number; truck_number: string }[]
  open: boolean
  onToggle: () => void
  states?: { state: string; miles: number }[]
  statesLoading: boolean
  onMatch: (truckId: number | null) => void
}) {
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="pl-3">
          <button onClick={onToggle} className="p-1 text-gray-400 hover:text-gray-700" title="Miles by state">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-4 py-2.5">
          <select
            value={v.truck_id ?? ''}
            onChange={e => onMatch(e.target.value ? Number(e.target.value) : null)}
            className={`border rounded-md px-2 py-1 text-sm ${v.truck_id ? 'border-gray-200' : 'border-amber-300 text-amber-700'}`}
          >
            <option value="">{v.truck_id ? 'Match automatically' : 'Not matched'}</option>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)}
          </select>
        </td>
        <td className="px-4 py-2.5 text-gray-700">
          {v.unit}
          {!v.active && <span className="ml-2 text-xs text-gray-400">inactive</span>}
        </td>
        <td className="px-4 py-2.5 text-gray-700">{v.driver_name ?? <span className="text-gray-400">—</span>}</td>
        {withOdometer && (
          <td
            className="px-4 py-2.5 text-right font-medium"
            title={v.odometer_miles != null
              ? `${v.start_odometer?.toLocaleString()} (${v.start_time ? new Date(v.start_time).toLocaleString() : ''}) → ${v.end_odometer?.toLocaleString()} (${v.end_time ? new Date(v.end_time).toLocaleString() : ''})`
              : 'No inspections with an odometer in this period'}
          >
            {v.odometer_miles != null ? fmtMiles(v.odometer_miles) : <span className="text-gray-400">—</span>}
          </td>
        )}
        <td className="px-4 py-2.5 text-right text-gray-600">{fmtMiles(v.miles)}</td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60">
          <td />
          <td colSpan={withOdometer ? 5 : 4} className="px-4 py-3">
            {statesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : states && states.length ? (
              <div className="flex flex-wrap gap-2">
                {states.map(s => (
                  <span key={s.state} className="rounded-md bg-white border border-gray-200 px-2 py-1 text-xs">
                    <b>{s.state}</b> {fmtMiles(s.miles)} mi
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No state miles for this period</span>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
