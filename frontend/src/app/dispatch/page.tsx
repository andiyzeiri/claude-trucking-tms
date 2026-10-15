'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Inter } from 'next/font/google'
import { CalendarClock, Coffee, Truck } from 'lucide-react'
import Layout from '@/components/layout/layout'
import { useDrivers } from '@/hooks/use-drivers'
import { useAILoads, useUpdateAILoad, type AILoad } from '@/hooks/use-loads-ai-ingestion'
import toast from 'react-hot-toast'
import { useEldConnection } from '@/hooks/use-eld'
import dynamic from 'next/dynamic'
import { useTruckLocations } from '@/components/dispatch/truck-map'

// The map uses window.google, so it renders in the browser only.
const TruckMap = dynamic(() => import('@/components/dispatch/truck-map').then(m => m.TruckMap), { ssr: false })

// Dispatch Board: the trucks on a map (Peak ELD), the drivers on a trip with
// its pickup and delivery, and the drivers without one - from Loads AI loads.

// '2026-10-14T08:00:00' -> '2026-10-14'. Pickup dates are wall-clock, so the
// day is read straight off the text rather than shifted through a time zone.
const dayKey = (value?: string | null) => (value ? String(value).slice(0, 10) : null)
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

// '123 Main St, Stow, OH 44224' -> 'Stow, OH'
function cityState(location?: string | null): string {
  const parts = String(location || '').split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].split(/\s+/)[0]
    return state ? `${parts[parts.length - 2]}, ${state}` : parts[parts.length - 2]
  }
  return parts[0] || ''
}

// One type scale for the page: semibold only for titles and driver names,
// medium for the main value in a cell, regular muted text under it.
const TEXT = {
  title: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--monday-text-primary)' },
  section: { fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--monday-text-primary)' },
  head: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--monday-text-muted)', whiteSpace: 'nowrap' },
  name: { fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' },
  main: { fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' },
  sub: { fontSize: '12px', fontWeight: 400, color: 'var(--monday-text-secondary)' },
  note: { fontSize: '11px', fontWeight: 400, color: 'var(--monday-text-muted)' },
  pill: { fontSize: '11px', fontWeight: 500 },
} as const satisfies Record<string, React.CSSProperties>

const UPCOMING_DAYS = [1, 2, 3, 5, 7]
const UPCOMING_LABEL: Record<number, string> = { 1: 'Tomorrow', 2: '2 days', 3: '3 days', 5: '5 days', 7: 'Next week' }

const inter = Inter({ subsets: ['latin'], display: 'swap' })

// 'Wed 10/15' from a wall-clock date.
function dayLabel(date?: string | null): string | null {
  const day = dayKey(date)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'EEE M/d')
}

// Whole days from a wall-clock date to today.
function daysSince(date?: string | null): number | null {
  const day = dayKey(date)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  const now = new Date()
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#4f46e5', '#0891b2', '#65a30d', '#c026d3', '#dc2626']

function Avatar({ id, first, last }: { id: number; first: string; last: string }) {
  const color = AVATAR_COLORS[id % AVATAR_COLORS.length]
  return (
    <span
      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: color, fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em' }}
    >
      {`${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase()}
    </span>
  )
}

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-px" style={{ ...TEXT.pill, color, backgroundColor: bg, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// Same colours as Loads AI: a window green, an appointment orange, no time grey.
const TIME_COLOR: Record<string, string> = { window: '#059669', appointment: '#d97706', none: '#94a3b8' }

function LoadCell({ load }: { load: AILoad }) {
  const f = load.fields || {}
  return (
    <td className="px-3 py-1.5 align-top" style={{ lineHeight: 1.35 }}>
      <div style={{ ...TEXT.main, fontVariantNumeric: 'tabular-nums' }}>{f.broker_load_number || f.load_number || `#${load.id}`}</div>
      {load.broker_name && <div className="truncate" style={{ ...TEXT.sub, maxWidth: '180px' }}>{load.broker_name}</div>}
    </td>
  )
}

function Stop({ kind, location, date, time, extraStops = 0 }: { kind: 'pickup' | 'delivery'; location?: string | null; date?: string | null; time?: { kind: string; text: string } | null; extraStops?: number }) {
  const day = dayLabel(date)
  return (
    <div className="flex gap-2">
      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: kind === 'pickup' ? '#10b981' : '#ef4444', boxShadow: `0 0 0 3px ${kind === 'pickup' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'}` }} />
      <div className="min-w-0" style={{ lineHeight: 1.35 }}>
        <div className="flex items-center gap-1.5">
          <span className="truncate" style={TEXT.main}>{cityState(location) || '-'}</span>
          {extraStops > 0 && <Pill text={`+${extraStops} stop${extraStops === 1 ? '' : 's'}`} color="#7c3aed" bg="rgba(124,58,237,.12)" />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" style={TEXT.sub}>
          {day && <span>{day}</span>}
          {time && time.kind !== 'none' && <span style={{ color: TIME_COLOR[time.kind] || TIME_COLOR.none, fontWeight: 500 }}>{time.text}</span>}
        </div>
      </div>
    </div>
  )
}

export default function DispatchBoardPage() {
  const { data: driversData } = useDrivers(1, 500)
  const { data: aiLoads = [], isLoading, error } = useAILoads()
  const { data: eld } = useEldConnection()
  const { data: locations = [], error: locationsError, dataUpdatedAt } = useTruckLocations(!!eld?.connected)

  // Current drivers. "Outside Carrier" and "Brokerage Account" are placeholder
  // drivers for brokered loads, not people.
  const isPlaceholder = (name: string) => /outside carrier|brokerage/i.test(name)
  const drivers = useMemo(() => {
    const all = driversData?.items || []
    return all
      .filter(d => !d.date_terminated && !isPlaceholder(`${d.first_name} ${d.last_name}`))
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
  }, [driversData])

  // Each current driver's trip: the load they're on today (picked up on or
  // before today, delivering today or later), else their next load. Drivers
  // with neither have no trip; for them, where they last delivered.
  const { active, idle } = useMemo(() => {
    const todayKey = ymd(new Date())
    const byDriver = new Map<number, AILoad[]>()
    aiLoads.forEach(l => {
      const id = Number(l.fields?.driver_id)
      if (id) byDriver.set(id, [...(byDriver.get(id) || []), l])
    })
    const active: { driver: (typeof drivers)[number]; load: AILoad; now: boolean }[] = []
    const idle: { driver: (typeof drivers)[number]; last: AILoad | null }[] = []
    drivers.forEach(driver => {
      const loads = byDriver.get(driver.id) || []
      const pick = (l: AILoad) => dayKey(l.fields?.pickup_date) || ''
      const drop = (l: AILoad) => dayKey(l.fields?.delivery_date) || pick(l)
      const byPickup = (a: AILoad, b: AILoad) => String(a.fields?.pickup_date).localeCompare(String(b.fields?.pickup_date))
      const current = loads.filter(l => pick(l) && pick(l) <= todayKey && drop(l) >= todayKey).sort(byPickup)[0]
      const next = loads.filter(l => pick(l) > todayKey).sort(byPickup)[0]
      if (current || next) {
        active.push({ driver, load: (current || next)!, now: !!current })
      } else {
        const last = loads.filter(l => drop(l) && drop(l) < todayKey)
          .sort((a, b) => String(b.fields?.delivery_date || b.fields?.pickup_date).localeCompare(String(a.fields?.delivery_date || a.fields?.pickup_date)))[0]
        idle.push({ driver, last: last || null })
      }
    })
    active.sort((a, b) => Number(b.now) - Number(a.now) || String(a.load.fields?.delivery_date).localeCompare(String(b.load.fields?.delivery_date)))
    return { active, idle }
  }, [aiLoads, drivers])

  // Upcoming trips: loads picking up from tomorrow through the next `ahead`
  // days (any driver, or none yet), soonest first. Loads on the placeholder
  // drivers are brokered, not ours, so they're left out.
  const [ahead, setAhead] = useState(7)
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem('dispatch-upcoming-days'))
      if (UPCOMING_DAYS.includes(v)) setAhead(v)
    } catch {}
  }, [])
  const chooseAhead = (n: number) => {
    setAhead(n)
    try { localStorage.setItem('dispatch-upcoming-days', String(n)) } catch {}
  }
  // Assigning a driver on Upcoming trips saves it on the Loads AI load, exactly
  // as choosing one on the Loads AI page does (and texts the driver the load
  // the same way, when load texts are on).
  const updateLoad = useUpdateAILoad()
  const [savingId, setSavingId] = useState<number | null>(null)
  const assignDriver = (load: AILoad, driverId: number | null) => {
    setSavingId(load.id)
    updateLoad.mutate(
      { id: load.id, data: { driver_id: driverId } },
      {
        onSuccess: () => {
          const d = drivers.find(x => x.id === driverId)
          const num = load.fields?.broker_load_number || load.fields?.load_number || `#${load.id}`
          toast.success(d ? `${d.first_name} ${d.last_name} assigned to load ${num}` : `Load ${num} unassigned`)
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail?.toString?.() || 'Couldn\u2019t assign the driver'),
        onSettled: () => setSavingId(null),
      },
    )
  }
  // Current drivers to pick from, plus the load's own driver if they're not one (e.g. since terminated).
  const pickable = (current: { id: number; first_name: string; last_name: string } | null) =>
    current && !drivers.some(d => d.id === current.id) ? [current, ...drivers] : drivers

  const upcoming = useMemo(() => {
    const now = new Date()
    const from = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    const to = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead))
    const byId = new Map((driversData?.items || []).map(d => [d.id, d]))
    return aiLoads
      .filter(l => {
        const day = dayKey(l.fields?.pickup_date)
        if (!day || day < from || day > to) return false
        const d = byId.get(Number(l.fields?.driver_id))
        return !d || !isPlaceholder(`${d.first_name} ${d.last_name}`)
      })
      .map(l => ({ load: l, driver: byId.get(Number(l.fields?.driver_id)) || null }))
      .sort((a, b) => String(a.load.fields?.pickup_date).localeCompare(String(b.load.fields?.pickup_date)))
  }, [aiLoads, driversData, ahead])

  const line = { borderColor: 'var(--monday-border-light)' }

  const th = (label: string) => (
    <th className="px-3 py-2 text-left" style={TEXT.head}>{label}</th>
  )
  const heading = (title: string, count: number, icon: React.ReactNode, color: string, bg: string) => (
    <div className="mb-2 flex items-center gap-2.5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: bg, color }}>{icon}</span>
      <h2 style={TEXT.section}>{title}</h2>
      <span className="rounded-full px-2 py-px" style={{ ...TEXT.pill, fontVariantNumeric: 'tabular-nums', color, backgroundColor: bg }}>{count}</span>
    </div>
  )
  const driverCell = (driver: (typeof drivers)[number], status?: React.ReactNode) => (
    <td className="px-3 py-1.5 align-top">
      <div className="flex items-center gap-2.5">
        <Avatar id={driver.id} first={driver.first_name} last={driver.last_name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2" style={{ lineHeight: 1.35 }}>
            <span className="truncate" style={TEXT.name}>{driver.first_name} {driver.last_name}</span>
            {status}
          </div>
        </div>
      </div>
    </td>
  )
  const empty = (cols: number, text: string) => (
    <tr><td colSpan={cols} className="px-4 py-6 text-center" style={{ ...TEXT.sub, color: 'var(--monday-text-muted)' }}>{text}</td></tr>
  )

  return (
    <Layout>
      <div className={`p-6 space-y-6 antialiased ${inter.className}`} style={{ fontFeatureSettings: '"cv11", "ss01"' }}>
        <h1 style={TEXT.title}>Dispatch Board</h1>

        {/* Square truck map top left with drivers without a trip under it; active drivers to its right */}
        <div className="grid gap-6 lg:grid-cols-[minmax(380px,38%)_minmax(0,760px)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <div>
              {eld?.connected ? (
                <>
                  <div style={{ aspectRatio: '1 / 1', width: '100%' }}>
                    <TruckMap trucks={locations} height="100%" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-between gap-x-2" style={TEXT.note}>
                    <span>
                      {locationsError
                        ? ((locationsError as any)?.response?.data?.detail || 'Couldn’t get truck locations from Peak ELD')
                        : `${locations.length} truck${locations.length === 1 ? '' : 's'} from Peak ELD · green = moving`}
                    </span>
                    {dataUpdatedAt > 0 && <span>Updated {format(new Date(dataUpdatedAt), 'h:mm a')} · refreshes every minute</span>}
                  </div>
                </>
              ) : eld && !eld.connected ? (
                <p style={{ ...TEXT.sub, color: 'var(--monday-text-muted)' }}>Connect Peak ELD in Settings to see your trucks on a map here.</p>
              ) : null}
            </div>

            <section>
              {heading('No trip', idle.length, <Coffee className="h-4 w-4" />, '#b45309', 'rgba(245,158,11,.16)')}
              <div className="overflow-x-auto rounded-xl border" style={line}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(245,158,11,.08)' }}><tr>{th('Driver')}{th('Last delivery')}</tr></thead>
                  <tbody>
                    {idle.length === 0 && empty(2, isLoading ? 'Loading\u2026' : 'Every driver has a trip.')}
                    {idle.map(({ driver, last }) => {
                      const lastDate = last ? (last.fields?.delivery_date || last.fields?.pickup_date) : null
                      const days = daysSince(lastDate)
                      return (
                        <tr key={driver.id} className="border-t transition-colors hover:bg-[rgba(245,158,11,0.05)]" style={line}>
                          {driverCell(driver, days == null
                            ? <Pill text="No loads yet" color="#64748b" bg="rgba(100,116,139,.12)" />
                            : <Pill text={days <= 0 ? 'Free today' : `Free ${days} day${days === 1 ? '' : 's'}`} color={days > 3 ? '#b91c1c' : '#b45309'} bg={days > 3 ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.16)'} />)}
                          <td className="px-3 py-1.5 align-top">
                            {last
                              ? <Stop kind="delivery" location={last.fields?.delivery_location} date={lastDate} time={last.delivery_time} />
                              : <span style={{ ...TEXT.sub, color: 'var(--monday-text-muted)' }}>-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-8">
            <section>
              {heading('Active drivers', active.length, <Truck className="h-4 w-4" />, '#047857', 'rgba(16,185,129,.14)')}
              <div className="overflow-x-auto rounded-xl border" style={line}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(16,185,129,.07)' }}><tr>{th('Driver')}{th('Load')}{th('Pickup')}{th('Delivery')}</tr></thead>
                  <tbody>
                    {active.length === 0 && empty(4, error ? 'Couldn\u2019t load the Loads AI loads. The Dispatch Board needs access to Loads AI.' : isLoading ? 'Loading\u2026' : 'No drivers on a trip.')}
                    {active.map(({ driver, load, now }) => {
                      const f = load.fields || {}
                      return (
                        <tr key={driver.id} className="border-t transition-colors hover:bg-[rgba(37,99,235,0.04)]" style={line}>
                          {driverCell(driver, now
                            ? <Pill text="On a trip" color="#047857" bg="rgba(16,185,129,.15)" />
                            : <Pill text="Next trip" color="#1d4ed8" bg="rgba(37,99,235,.12)" />)}
                          <LoadCell load={load} />
                          <td className="px-3 py-1.5 align-top"><Stop kind="pickup" location={f.pickup_location} date={f.pickup_date} time={load.pickup_time} /></td>
                          <td className="px-3 py-1.5 align-top"><Stop kind="delivery" location={f.delivery_location} date={f.delivery_date} time={load.delivery_time} extraStops={Math.max(0, (f.stops?.length || 0) - 1)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {heading('Upcoming trips', upcoming.length, <CalendarClock className="h-4 w-4" />, '#1d4ed8', 'rgba(37,99,235,.12)')}
                <div className="mb-2 inline-flex rounded-lg border p-0.5" style={line}>
                  {UPCOMING_DAYS.map(n => (
                    <button
                      key={n}
                      onClick={() => chooseAhead(n)}
                      className="rounded-md px-2.5 py-1 transition-colors"
                      style={{
                        ...TEXT.pill, fontSize: '12px',
                        backgroundColor: ahead === n ? '#2563eb' : 'transparent',
                        color: ahead === n ? '#fff' : 'var(--monday-text-secondary)',
                      }}
                    >
                      {UPCOMING_LABEL[n]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border" style={line}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(37,99,235,.06)' }}><tr>{th('Driver')}{th('Load')}{th('Pickup')}{th('Delivery')}</tr></thead>
                  <tbody>
                    {upcoming.length === 0 && empty(4, isLoading ? 'Loading\u2026' : `No trips picking up ${ahead === 1 ? 'tomorrow' : `in the next ${ahead} days`}.`)}
                    {upcoming.map(({ load, driver }) => {
                      const f = load.fields || {}
                      return (
                        <tr key={load.id} className="border-t transition-colors hover:bg-[rgba(37,99,235,0.04)]" style={line}>
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex items-center gap-2.5">
                              {driver
                                ? <Avatar id={driver.id} first={driver.first_name} last={driver.last_name} />
                                : <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ border: '1.5px dashed #ef4444', color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>?</span>}
                              <select
                                value={driver?.id ?? ''}
                                disabled={savingId === load.id}
                                onChange={e => assignDriver(load, e.target.value ? Number(e.target.value) : null)}
                                className="min-w-0 max-w-[170px] cursor-pointer truncate rounded-md border bg-transparent py-1 pl-2 pr-6 hover:border-blue-400 focus:border-blue-500 focus:outline-none"
                                style={{ ...(driver ? TEXT.name : { ...TEXT.main, color: '#b91c1c' }), borderColor: driver ? 'var(--monday-border-light)' : 'rgba(239,68,68,.45)', opacity: savingId === load.id ? 0.5 : 1 }}
                                title={driver ? 'Change driver' : 'Assign a driver'}
                              >
                                <option value="">{driver ? 'Unassign' : 'Assign driver\u2026'}</option>
                                {pickable(driver).map(d => (
                                  <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <LoadCell load={load} />
                          <td className="px-3 py-1.5 align-top"><Stop kind="pickup" location={f.pickup_location} date={f.pickup_date} time={load.pickup_time} /></td>
                          <td className="px-3 py-1.5 align-top"><Stop kind="delivery" location={f.delivery_location} date={f.delivery_date} time={load.delivery_time} extraStops={Math.max(0, (f.stops?.length || 0) - 1)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  )
}
