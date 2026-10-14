'use client'

import React, { useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { useDrivers } from '@/hooks/use-drivers'
import { useAILoads, type AILoad } from '@/hooks/use-loads-ai-ingestion'
import { formatCurrency } from '@/lib/utils'
import { useEldConnection } from '@/hooks/use-eld'
import dynamic from 'next/dynamic'
import { useTruckLocations } from '@/components/dispatch/truck-map'

// The map uses window.google, so it renders in the browser only.
const TruckMap = dynamic(() => import('@/components/dispatch/truck-map').then(m => m.TruckMap), { ssr: false })

// Dispatch Board: drivers down the left, Monday-Sunday across, and each
// Loads AI load on its pickup day in its driver's row. Loads with no driver
// (or a driver not listed) go on the Unassigned row at the bottom.

const UNASSIGNED = 0

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

// 'Wed 10/15 · 8a – 3p' from a wall-clock date and the page's time text.
function when(date?: string | null, time?: { kind: string; text: string } | null): string {
  const day = dayKey(date)
  if (!day) return '-'
  const [y, m, d] = day.split('-').map(Number)
  const label = format(new Date(y, m - 1, d), 'EEE M/d')
  return time && time.kind !== 'none' ? `${label} · ${time.text}` : label
}

function LoadLine({ load }: { load: AILoad }) {
  const f = load.fields || {}
  const number = f.broker_load_number || f.load_number || `#${load.id}`
  const from = cityState(f.pickup_location)
  const to = cityState(f.delivery_location)
  const rate = Number(f.rate)
  return (
    <div
      className="py-1"
      title={[`Load ${number}`, load.broker_name, f.pickup_location && `Pickup: ${f.pickup_location}`, f.delivery_location && `Delivery: ${f.delivery_location}`].filter(Boolean).join('\n')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium truncate" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>{number}</span>
        {rate > 0 && <span style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>{formatCurrency(rate)}</span>}
      </div>
      {(from || to) && (
        <div className="truncate" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          {from || '?'} → {to || '?'}
        </div>
      )}
    </div>
  )
}

export default function DispatchBoardPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const { data: driversData } = useDrivers(1, 500)
  const { data: aiLoads = [], isLoading, error } = useAILoads()
  const { data: eld } = useEldConnection()
  const { data: locations = [], error: locationsError, dataUpdatedAt } = useTruckLocations(!!eld?.connected)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // driver id (0 = unassigned) -> day -> loads picking up that day
  const byDriverDay = useMemo(() => {
    const week = new Set(weekDays.map(ymd))
    const m = new Map<number, Map<string, AILoad[]>>()
    aiLoads.forEach(l => {
      const day = dayKey(l.fields?.pickup_date)
      if (!day || !week.has(day)) return
      const driverId = Number(l.fields?.driver_id) || UNASSIGNED
      if (!m.has(driverId)) m.set(driverId, new Map())
      const days = m.get(driverId)!
      days.set(day, [...(days.get(day) || []), l])
    })
    m.forEach(days => days.forEach(list => list.sort((a, b) => String(a.fields?.pickup_date).localeCompare(String(b.fields?.pickup_date)))))
    return m
  }, [aiLoads, weekDays])

  // Active drivers, plus anyone (e.g. since terminated) who has a load this week.
  const drivers = useMemo(() => {
    const all = driversData?.items || []
    return all
      .filter(d => {
        const name = `${d.first_name} ${d.last_name}`.toLowerCase()
        if (name.includes('outside carrier')) return false
        return !d.date_terminated || byDriverDay.has(d.id)
      })
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
  }, [driversData, byDriverDay])

  // Loads whose driver isn't on the list go with the unassigned ones.
  const unassigned = useMemo(() => {
    const listed = new Set(drivers.map(d => d.id))
    const days = new Map<string, AILoad[]>()
    byDriverDay.forEach((driverDays, driverId) => {
      if (driverId !== UNASSIGNED && listed.has(driverId)) return
      driverDays.forEach((list, day) => days.set(day, [...(days.get(day) || []), ...list]))
    })
    return days
  }, [byDriverDay, drivers])

  const weekCount = useMemo(() => {
    let n = 0
    byDriverDay.forEach(days => days.forEach(list => { n += list.length }))
    return n
  }, [byDriverDay])

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
    drivers.filter(d => !d.date_terminated).forEach(driver => {
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

  const line = { borderColor: 'var(--monday-border-light)' }
  const today = new Date()

  const row = (key: string | number, label: string, days: Map<string, AILoad[]> | undefined, muted = false) => (
    <tr key={key}>
      <td
        className="sticky left-0 z-10 px-3 py-2 align-top border-b"
        style={{ ...line, backgroundColor: 'var(--monday-bg-primary)', fontSize: '13px', fontWeight: 500, color: muted ? 'var(--monday-text-secondary)' : 'var(--monday-text-primary)', whiteSpace: 'nowrap' }}
      >
        {label}
      </td>
      {weekDays.map(day => (
        <td
          key={ymd(day)}
          className="px-3 py-1 align-top border-b"
          style={{ ...line, backgroundColor: isSameDay(day, today) ? 'rgba(37, 99, 235, 0.04)' : undefined }}
        >
          {(days?.get(ymd(day)) || []).map(l => <LoadLine key={l.id} load={l} />)}
        </td>
      ))}
    </tr>
  )

  const th = (label: string) => (
    <th className="px-3 py-2 text-left border-b" style={{ ...line, fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', whiteSpace: 'nowrap' }}>{label}</th>
  )
  const td = (content: React.ReactNode, sub?: React.ReactNode) => (
    <td className="px-3 py-2 align-top border-b" style={line}>
      <div style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>{content}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>{sub}</div>}
    </td>
  )
  const heading = (title: string, count: number) => (
    <h2 className="mb-1 font-semibold" style={{ fontSize: '14px', color: 'var(--monday-text-primary)' }}>
      {title} <span style={{ fontWeight: 400, color: 'var(--monday-text-muted)' }}>({count})</span>
    </h2>
  )

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Dispatch Board</h1>

        {/* Square truck map top left; active drivers and drivers without a trip to its right */}
        <div className="grid gap-6 lg:grid-cols-[minmax(320px,32%)_1fr] lg:items-start">
          <div>
            {eld?.connected ? (
              <>
                <div style={{ aspectRatio: '1 / 1', width: '100%' }}>
                  <TruckMap trucks={locations} height="100%" />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-2" style={{ fontSize: '11px', color: 'var(--monday-text-muted)' }}>
                  <span>
                    {locationsError
                      ? ((locationsError as any)?.response?.data?.detail || 'Couldn’t get truck locations from Peak ELD')
                      : `${locations.length} truck${locations.length === 1 ? '' : 's'} from Peak ELD · green = moving`}
                  </span>
                  {dataUpdatedAt > 0 && <span>Updated {format(new Date(dataUpdatedAt), 'h:mm a')} · refreshes every minute</span>}
                </div>
              </>
            ) : eld && !eld.connected ? (
              <p style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>Connect Peak ELD in Settings to see your trucks on a map here.</p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-6">
            <div>
              {heading('Active drivers', active.length)}
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead><tr>{th('Driver')}{th('Load')}{th('Pickup')}{th('Delivery')}</tr></thead>
                  <tbody>
                    {active.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-3" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>{isLoading ? 'Loading…' : 'No drivers on a trip.'}</td></tr>
                    )}
                    {active.map(({ driver, load, now }) => {
                      const f = load.fields || {}
                      return (
                        <tr key={driver.id}>
                          {td(`${driver.first_name} ${driver.last_name}`, now ? 'On a trip' : 'Next trip')}
                          {td(f.broker_load_number || f.load_number || `#${load.id}`, load.broker_name)}
                          {td(cityState(f.pickup_location) || '-', when(f.pickup_date, load.pickup_time))}
                          {td(cityState(f.delivery_location) || '-', when(f.delivery_date, load.delivery_time))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              {heading('No trip', idle.length)}
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead><tr>{th('Driver')}{th('Last delivery')}</tr></thead>
                  <tbody>
                    {idle.length === 0 && (
                      <tr><td colSpan={2} className="px-3 py-3" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>{isLoading ? 'Loading…' : 'Every driver has a trip.'}</td></tr>
                    )}
                    {idle.map(({ driver, last }) => (
                      <tr key={driver.id}>
                        {td(`${driver.first_name} ${driver.last_name}`)}
                        {last
                          ? td(cityState(last.fields?.delivery_location) || '-', when(last.fields?.delivery_date || last.fields?.pickup_date, last.delivery_time))
                          : td(<span style={{ color: 'var(--monday-text-muted)' }}>-</span>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* The week: drivers down the left, Monday-Sunday across */}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(w => addDays(w, -7))} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(w => addDays(w, 7))} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 font-medium" style={{ color: 'var(--monday-text-primary)' }}>
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <span className="ml-2" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>
              {isLoading ? 'Loading…' : `${weekCount} load${weekCount === 1 ? '' : 's'}`}
            </span>
          </div>
          {error ? (
            <p style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
              Couldn&apos;t load the Loads AI loads. Seeing the Dispatch Board needs access to Loads AI.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: '1000px' }}>
                <colgroup>
                  <col style={{ width: '170px' }} />
                  {weekDays.map(d => <col key={ymd(d)} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b" style={{ ...line, backgroundColor: 'var(--monday-bg-primary)' }} />
                    {weekDays.map(day => {
                      const isToday = isSameDay(day, today)
                      return (
                        <th key={ymd(day)} className="px-3 py-2 text-left border-b" style={line}>
                          <span style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: isToday ? '#2563eb' : 'var(--monday-text-secondary)' }}>
                            {format(day, 'EEE')}
                          </span>
                          <span className="ml-1.5" style={{ fontSize: '14px', fontWeight: 600, color: isToday ? '#2563eb' : 'var(--monday-text-primary)' }}>
                            {format(day, 'd')}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map(d => row(d.id, `${d.first_name} ${d.last_name}`, byDriverDay.get(d.id)))}
                  {unassigned.size > 0 && row('unassigned', 'Unassigned', unassigned, true)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
