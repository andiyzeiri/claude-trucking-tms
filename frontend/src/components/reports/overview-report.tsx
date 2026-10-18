'use client'

import React, { useMemo, useState } from 'react'
import { useEldConnection, useEldMileage } from '@/hooks/use-eld'
import {
  usePayrollModel, currentWeekNumber, generateWeeks, ymd, TABS, tabOf,
  type DriverTab,
} from '@/hooks/use-payroll-model'
import {
  addStat, cellStat, derived, emptyStat, money, num, pct, perMile,
  PROFIT_HELP, PROFIT_LABEL, type PayrollEntry, type Stat,
} from './report-stats'

type Filter = 'all' | DriverTab
const GREEN = 'var(--monday-done)'
const RED = 'var(--monday-stuck)'

/** Every week's totals for a year (drivers employed that week), optionally one driver type. */
function useYearStats(year: number, filter: Filter) {
  const model = usePayrollModel(year, 0, false)
  const { weeks, payrollData, calculatedPayroll, getDriversForWeek, rowsFor } = model
  const byWeek = useMemo(() => {
    const entries = new Map<string, PayrollEntry>()
    if (Array.isArray(calculatedPayroll)) calculatedPayroll.forEach((e: any) => entries.set(`${e.driver_id}_${e.week_number}`, e))
    return weeks.map(w => {
      const employed = new Set(getDriversForWeek(w.weekNumber).map(d => d.id))
      const total = emptyStat()
      const trucks = new Set<number>()
      payrollData.forEach(d => {
        if (!employed.has(d.driver_id)) return
        const t = tabOf(d.driver_type)
        if (filter !== 'all' && t !== filter) return
        const e = entries.get(`${d.driver_id}_${w.weekNumber}`)
        const s = cellStat(d, w.weekNumber, rowsFor(t), e, 0)
        if (!s) return
        addStat(total, s)
        if (e?.truck_id) trucks.add(Number(e.truck_id))
      })
      return { week: w, total, trucks }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrollData, calculatedPayroll, weeks, filter])
  return { model, byWeek }
}

/**
 * Reports > Overview: the year's totals (against the same weeks last year)
 * and a week-by-week chart of gross and profit.
 */
export default function OverviewReport({ year }: { year: number }) {
  const [filter, setFilter] = useState<Filter>('all')
  const { model, byWeek } = useYearStats(year, filter)
  const last = useYearStats(year - 1, filter)

  // Weeks so far: the whole year for past years, up to this week for this one.
  const thisWeek = currentWeekNumber(generateWeeks(year))
  const isCurrent = year === new Date().getFullYear() && thisWeek != null
  const upTo = isCurrent ? thisWeek! : 52
  const sumWeeks = (rows: typeof byWeek, n: number) => rows.filter(r => r.week.weekNumber <= n).reduce((acc, r) => addStat(acc, r.total), emptyStat())
  const total = sumWeeks(byWeek, upTo)
  const lastTotal = sumWeeks(last.byWeek, upTo)

  // ELD miles for the year, for the trucks these drivers ran (deadhead, MPG, per-mile costs).
  const { data: eldConnection } = useEldConnection()
  const weeks = model.weeks
  const rangeStart = weeks[0]?.startDate
  const rangeEnd = weeks[Math.min(upTo, weeks.length) - 1]?.endDate
  const today = new Date()
  const { data: eld, isLoading: eldLoading } = useEldMileage(
    rangeStart ? ymd(rangeStart) : '',
    rangeEnd ? ymd(rangeEnd > today ? today : rangeEnd) : '',
    !!eldConnection?.connected,
    true,
  )
  const withEld: Stat = useMemo(() => {
    const s = { ...total, costs: { ...total.costs } }
    if (!eld) return s
    const trucks = new Set<number>()
    byWeek.forEach(r => { if (r.week.weekNumber <= upTo) r.trucks.forEach(t => trucks.add(t)) })
    const miles = (eld.vehicles || []).reduce((t, v) => (v.truck_id && trucks.has(v.truck_id) ? t + (v.odometer_miles ?? v.miles ?? 0) : t), 0)
    if (miles > 0) {
      s.totalMiles = Math.round(miles)
      s.trackedLoadedMiles = total.loadedMiles
      s.trackedGallons = total.gallons
    }
    return s
  }, [total, eld, byWeek, upTo])

  const d = derived(withEld)
  const ld = derived(lastTotal)
  const hasLastYear = lastTotal.gross > 0
  const label = filter === 'all' ? 'Net profit' : PROFIT_LABEL[filter]
  const help = filter === 'all'
    ? 'Company drivers: gross minus deductions and driver pay. Owner operators: the dispatch fee. Company owners: net pay.'
    : PROFIT_HELP[filter]

  const loading = model.driversLoading || model.payrollLoading || model.layoutLoading

  const groups: { title: string; tiles: { label: string; value: string; help?: string; color?: string; now?: number | null; before?: number | null; invert?: boolean; asPct?: boolean }[] }[] = [
    {
      title: 'Revenue',
      tiles: [
        { label: 'Gross', value: money(withEld.gross), now: withEld.gross, before: lastTotal.gross },
        { label: 'Loads', value: num(withEld.loads), now: withEld.loads, before: lastTotal.loads },
        { label: 'Average per load', value: money(d.avgPerLoad), now: d.avgPerLoad, before: ld.avgPerLoad },
        { label: 'Rate per loaded mile', value: perMile(d.rpm), now: d.rpm, before: ld.rpm, help: 'Gross ÷ loaded (trip) miles' },
      ],
    },
    {
      title: 'Miles',
      tiles: [
        { label: 'Loaded miles', value: num(withEld.loadedMiles), now: withEld.loadedMiles, before: lastTotal.loadedMiles },
        { label: 'Total miles (ELD)', value: withEld.totalMiles ? num(withEld.totalMiles) : eldLoading ? '…' : '—', help: 'Peak ELD miles for the trucks these drivers ran' },
        { label: 'Deadhead', value: pct(d.deadheadPct), color: (d.deadheadPct ?? 0) > 0.15 ? RED : undefined, help: 'ELD miles not covered by loaded miles' },
        { label: 'Rate per total mile', value: perMile(d.rpmAll), help: 'Gross ÷ ELD miles' },
      ],
    },
    {
      title: 'Fuel',
      tiles: [
        { label: 'Fuel cost', value: money(withEld.fuel), now: withEld.fuel, before: lastTotal.fuel, invert: true },
        { label: 'Gallons', value: withEld.gallons ? num(withEld.gallons) : '—', now: withEld.gallons || null, before: lastTotal.gallons || null, invert: true },
        { label: 'MPG', value: num(d.mpg, 2), help: 'ELD miles ÷ gallons' },
        { label: 'Fuel per mile', value: perMile(d.fuelPerMile) },
      ],
    },
    {
      title: 'Costs & profit',
      tiles: [
        { label: 'Driver pay', value: money(withEld.driverPay), now: withEld.driverPay, before: lastTotal.driverPay, invert: true, help: 'Net pay to company drivers and owner operators' },
        { label: 'Total costs', value: money(withEld.totalCosts), now: withEld.totalCosts, before: lastTotal.totalCosts, invert: true },
        { label: 'Cost per mile', value: perMile(d.costPerMile), help: 'Per ELD mile when known, else per loaded mile' },
        { label, value: money(withEld.profit), color: withEld.profit < 0 ? RED : GREEN, now: withEld.profit, before: lastTotal.profit, help },
        { label: 'Profit per mile', value: perMile(d.profitPerMile) },
        { label: 'Margin', value: pct(d.margin), now: d.margin, before: ld.margin, asPct: true, help: `${label} ÷ gross` },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      {/* Driver type filter */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'All drivers'] as const, ...TABS.map(t => [t.key, t.label] as const)]).map(([key, text]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="rounded-full px-3 py-1 text-sm transition-colors"
            style={{
              border: '1px solid var(--monday-border-light)',
              backgroundColor: filter === key ? 'var(--monday-done)' : 'var(--monday-bg-primary)',
              color: filter === key ? 'white' : 'var(--monday-text-secondary)',
              fontWeight: 500,
            }}
          >
            {text}
          </button>
        ))}
        <span className="ml-auto" style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
          {isCurrent ? `Weeks 1–${upTo}, year to date` : `Full year ${year}`}
          {hasLastYear ? ` · compared with the same weeks of ${year - 1}` : ''}
        </span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Loading overview…</div>
      ) : (
        <>
          {groups.map(g => (
            <div key={g.title}>
              <div className="mb-2" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--monday-text-secondary)' }}>{g.title}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {g.tiles.map(t => (
                  <div key={t.label} className="rounded-lg p-3 shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }} title={t.help}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t.label}{t.help && <span style={{ marginLeft: 4, color: 'var(--monday-text-muted)', cursor: 'help' }}>ⓘ</span>}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: t.color || 'var(--monday-text-primary)', marginTop: '2px' }}>{t.value}</div>
                    {hasLastYear && <YearDelta now={t.now} before={t.before} invert={t.invert} asPct={t.asPct} />}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <TrendChart rows={byWeek.filter(r => r.week.weekNumber <= upTo).map(r => ({ week: r.week.weekNumber, gross: r.total.gross, profit: r.total.profit, loads: r.total.loads }))} profitLabel={label} />
        </>
      )}
    </div>
  )
}

function YearDelta({ now, before, invert, asPct }: { now?: number | null; before?: number | null; invert?: boolean; asPct?: boolean }) {
  if (now == null || before == null || !before) return <div style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>&nbsp;</div>
  const diff = now - before
  const good = invert ? diff < 0 : diff > 0
  const text = asPct ? `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)} pts` : `${diff > 0 ? '+' : ''}${((diff / Math.abs(before)) * 100).toFixed(0)}%`
  return <div style={{ fontSize: '12px', fontWeight: 500, color: Math.abs(diff) < 1e-9 ? 'var(--monday-text-muted)' : good ? GREEN : RED }}>{text} vs last year</div>
}

// Gross (light bars) and profit (green, red below zero) for every week; hover a week for its numbers.
function TrendChart({ rows, profitLabel }: { rows: { week: number; gross: number; profit: number; loads: number }[]; profitLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const H = 220
  const max = Math.max(1, ...rows.map(r => Math.max(r.gross, r.profit)))
  const min = Math.min(0, ...rows.map(r => r.profit))
  const span = max - min
  const hovered = rows.find(r => r.week === hover)
  return (
    <div className="rounded-lg p-4 shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="mb-3 flex flex-wrap items-baseline gap-4">
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>Week by week</span>
        <span className="flex items-center gap-1.5" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd', display: 'inline-block' }} /> Gross
        </span>
        <span className="flex items-center gap-1.5" style={{ fontSize: '12px', color: 'var(--monday-text-secondary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> {profitLabel}
        </span>
        <span className="ml-auto" style={{ fontSize: '13px', color: 'var(--monday-text-primary)', minHeight: 18 }}>
          {hovered ? <>Week {hovered.week}: <b>{money(hovered.gross)}</b> gross · <b style={{ color: hovered.profit < 0 ? RED : GREEN }}>{money(hovered.profit)}</b> {profitLabel.toLowerCase()} · {hovered.loads} loads</> : 'Hover a week'}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>No weeks with loads yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-stretch" style={{ height: H, minWidth: rows.length * 14, borderBottom: '1px solid var(--monday-border-light)' }} onMouseLeave={() => setHover(null)}>
            {rows.map(r => {
              const active = hover === r.week
              const zero = ((0 - min) / span) * 100 // % from the bottom
              const grossH = (Math.max(0, r.gross) / span) * 100
              const profitH = (Math.abs(r.profit) / span) * 100
              return (
                <div
                  key={r.week}
                  className="relative flex-1"
                  style={{ minWidth: 12, backgroundColor: active ? 'rgba(59,130,246,.07)' : undefined }}
                  onMouseEnter={() => setHover(r.week)}
                >
                  <div className="absolute rounded-sm" style={{ left: '12%', right: '12%', bottom: `${zero}%`, height: `${grossH}%`, background: '#93c5fd' }} />
                  <div
                    className="absolute rounded-sm"
                    style={{
                      left: '32%', right: '32%',
                      bottom: r.profit >= 0 ? `${zero}%` : `${zero - profitH}%`,
                      height: `${profitH}%`,
                      background: r.profit >= 0 ? '#16a34a' : '#dc2626',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex" style={{ minWidth: rows.length * 14 }}>
            {rows.map(r => (
              <div key={r.week} className="flex-1 text-center" style={{ minWidth: 12, fontSize: '10px', color: hover === r.week ? 'var(--monday-text-primary)' : 'var(--monday-text-secondary)' }}>
                {r.week % 4 === 1 || hover === r.week ? r.week : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
