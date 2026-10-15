'use client'

import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { Inter } from 'next/font/google'
import { Coffee, Truck } from 'lucide-react'
import Layout from '@/components/layout/layout'
import { useDrivers } from '@/hooks/use-drivers'
import { useAILoads, type AILoad } from '@/hooks/use-loads-ai-ingestion'
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
      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: color, fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}
    >
      {`${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase()}
    </span>
  )
}

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: '11px', fontWeight: 600, color, backgroundColor: bg, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// Same colours as Loads AI: a window green, an appointment orange, no time grey.
const TIME_COLOR: Record<string, string> = { window: '#059669', appointment: '#d97706', none: '#94a3b8' }

function Stop({ kind, location, date, time }: { kind: 'pickup' | 'delivery'; location?: string | null; date?: string | null; time?: { kind: string; text: string } | null }) {
  const day = dayLabel(date)
  return (
    <div className="flex gap-2">
      <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: kind === 'pickup' ? '#10b981' : '#ef4444', boxShadow: `0 0 0 3px ${kind === 'pickup' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'}` }} />
      <div className="min-w-0">
        <div className="truncate" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{cityState(location) || '-'}</div>
        <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: '12px' }}>
          {day && <span style={{ color: 'var(--monday-text-secondary)', fontWeight: 500 }}>{day}</span>}
          {time && time.kind !== 'none' && <span style={{ color: TIME_COLOR[time.kind] || TIME_COLOR.none, fontWeight: 600 }}>{time.text}</span>}
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

  // Current drivers (the Outside Carrier placeholder isn't one).
  const drivers = useMemo(() => {
    const all = driversData?.items || []
    return all
      .filter(d => !d.date_terminated && !`${d.first_name} ${d.last_name}`.toLowerCase().includes('outside carrier'))
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

  const line = { borderColor: 'var(--monday-border-light)' }

  const th = (label: string) => (
    <th className="px-4 py-2.5 text-left" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--monday-text-secondary)', whiteSpace: 'nowrap' }}>{label}</th>
  )
  const heading = (title: string, count: number, icon: React.ReactNode, color: string, bg: string) => (
    <div className="mb-2 flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: bg, color }}>{icon}</span>
      <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--monday-text-primary)' }}>{title}</h2>
      <span className="rounded-full px-2 py-0.5" style={{ fontSize: '12px', fontWeight: 700, color, backgroundColor: bg }}>{count}</span>
    </div>
  )
  const driverCell = (driver: (typeof drivers)[number], status?: React.ReactNode) => (
    <td className="px-4 py-3 align-top">
      <div className="flex items-center gap-3">
        <Avatar id={driver.id} first={driver.first_name} last={driver.last_name} />
        <div className="min-w-0">
          <div className="truncate" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{driver.first_name} {driver.last_name}</div>
          {status && <div className="mt-0.5">{status}</div>}
        </div>
      </div>
    </td>
  )
  const empty = (cols: number, text: string) => (
    <tr><td colSpan={cols} className="px-4 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>{text}</td></tr>
  )

  return (
    <Layout>
      <div className={`p-6 space-y-6 ${inter.className}`}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--monday-text-primary)' }}>Dispatch Board</h1>

        {/* Square truck map top left with drivers without a trip under it; active drivers to its right */}
        <div className="grid gap-6 lg:grid-cols-[minmax(380px,38%)_minmax(0,760px)] lg:items-start">
          <div className="min-w-0 space-y-8">
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
                          <td className="px-4 py-3 align-top">
                            {last
                              ? <Stop kind="delivery" location={last.fields?.delivery_location} date={lastDate} time={last.delivery_time} />
                              : <span style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="min-w-0">
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
                          <td className="px-4 py-3 align-top">
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--monday-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{f.broker_load_number || f.load_number || `#${load.id}`}</div>
                            {load.broker_name && <div className="truncate" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)', maxWidth: '180px' }}>{load.broker_name}</div>}
                          </td>
                          <td className="px-4 py-3 align-top"><Stop kind="pickup" location={f.pickup_location} date={f.pickup_date} time={load.pickup_time} /></td>
                          <td className="px-4 py-3 align-top"><Stop kind="delivery" location={f.delivery_location} date={f.delivery_date} time={load.delivery_time} /></td>
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
