'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTrucks } from '@/hooks/use-trucks'
import { useDriverOrder } from '@/hooks/use-payroll-layout'
import {
  usePayrollModel, generateWeeks, currentWeekNumber, TABS, TAB_BY_KEY, tabOf,
  type DriverTab, type DriverPayrollData, type Week,
} from '@/hooks/use-payroll-model'
import {
  addStat, cellStat, derived, emptyStat, money, num, pct, perMile,
  PAY_LABEL_BY_TAB, PROFIT_HELP, PROFIT_LABEL, type PayrollEntry, type Stat,
} from './report-stats'

const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const weekOptionLabel = (w: Week) =>
  `Week ${w.weekNumber} · ${fmtShort(w.startDate)} – ${w.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

type Line = { label: string; help?: string; value: (s: Stat) => string; strong?: boolean; color?: (s: Stat) => string | undefined }
type Group = { title: string; lines: Line[] }

const RED = 'var(--monday-stuck)'
const GREEN = 'var(--monday-done)'
const signColor = (n: number | null) => (n == null ? undefined : n < 0 ? RED : GREEN)

/**
 * Reports > Weekly: Payroll's week and driver columns, with the statistics
 * behind them - revenue, miles, fuel, costs and profit for each driver.
 */
export default function WeeklyReport({ year }: { year: number }) {
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeekNumber(generateWeeks(new Date().getFullYear())) ?? 1)
  const [tab, setTab] = useState<DriverTab>('company')
  const model = usePayrollModel(year, selectedWeek, true)
  const { weeks, payrollData, calculatedPayroll, getDriversForWeek, getOverride, driverSettings, eldMilesByTruck, rowsFor } = model
  const { data: trucksData } = useTrucks()
  const { data: driverOrder } = useDriverOrder(tab)
  useEffect(() => { setSelectedWeek(currentWeekNumber(weeks) ?? 1) }, [weeks])

  const entries = useMemo(() => {
    const m = new Map<string, PayrollEntry>()
    if (Array.isArray(calculatedPayroll)) calculatedPayroll.forEach((e: any) => m.set(`${e.driver_id}_${e.week_number}`, e))
    return m
  }, [calculatedPayroll])

  const truckOf = (driverId: number, wn: number): number | null => {
    const id = getOverride(driverId, wn, 'truck_id') ?? driverSettings?.find((s: any) => s.driver_id === driverId)?.truck_id
    return id ? Number(id) : null
  }
  const truckNumber = (id: number | null) => (id ? (trucksData?.items || []).find((t: any) => t.id === id)?.truck_number : null)

  // Drivers employed that week, in Payroll's column order.
  const columnsFor = (wn: number, t: DriverTab): DriverPayrollData[] => {
    const employed = new Set(getDriversForWeek(wn).map(d => d.id))
    const order = new Map((t === tab ? driverOrder || [] : []).map((id, i) => [id, i]))
    return payrollData
      .filter(d => employed.has(d.driver_id) && tabOf(d.driver_type) === t && d.weeks[wn])
      .sort((a, b) => (order.get(a.driver_id) ?? Infinity) - (order.get(b.driver_id) ?? Infinity) || a.driver_name.localeCompare(b.driver_name))
  }

  // ELD miles are only read for the week on screen.
  const statOf = (d: DriverPayrollData, wn: number): Stat | null => {
    const truck = truckOf(d.driver_id, wn)
    const eld = wn === selectedWeek && truck ? eldMilesByTruck.get(truck)?.miles : undefined
    return cellStat(d, wn, rowsFor(tabOf(d.driver_type)), entries.get(`${d.driver_id}_${wn}`), eld != null ? Math.round(eld) : 0)
  }
  const totalOf = (wn: number, t: DriverTab) =>
    columnsFor(wn, t).reduce((acc, d) => { const s = statOf(d, wn); return s ? addStat(acc, s) : acc }, emptyStat())

  const columns = columnsFor(selectedWeek, tab)
  const stats = columns.map(d => ({ d, s: statOf(d, selectedWeek)! }))
  const total = stats.reduce((acc, x) => addStat(acc, x.s), emptyStat())
  const prev = selectedWeek > 1 ? totalOf(selectedWeek - 1, tab) : null
  const week = weeks.find(w => w.weekNumber === selectedWeek)

  // Every payroll deduction row of this driver type, in Payroll's order (fuel has its own group).
  const costRows = rowsFor(tab).filter(r => !r.hidden && r.kind === 'deduction' && r.key !== 'fuel')
  const groups: Group[] = [
    {
      title: 'Revenue',
      lines: [
        { label: 'Gross', value: s => money(s.gross), strong: true },
        { label: 'Loads', value: s => num(s.loads) },
        { label: 'Average per load', value: s => money(derived(s).avgPerLoad) },
        { label: 'Rate per loaded mile', help: 'Gross ÷ loaded (trip) miles', value: s => perMile(derived(s).rpm) },
        { label: 'Rate per total mile', help: 'Gross ÷ ELD miles', value: s => perMile(derived(s).rpmAll) },
      ],
    },
    {
      title: 'Miles',
      lines: [
        { label: 'Loaded miles', help: 'Trip miles on the loads', value: s => num(s.loadedMiles) },
        { label: 'Total miles (ELD)', help: "What the truck drove that week, from Peak ELD (Payroll's Total Miles)", value: s => (s.totalMiles ? num(s.totalMiles) : '—') },
        { label: 'Deadhead miles', help: 'ELD miles minus loaded miles', value: s => num(derived(s).deadhead) },
        { label: 'Deadhead %', value: s => pct(derived(s).deadheadPct), color: s => ((derived(s).deadheadPct ?? 0) > 0.15 ? RED : undefined) },
      ],
    },
    {
      title: 'Fuel',
      lines: [
        { label: 'Gallons', help: "Diesel on the truck's fuel cards that week", value: s => (s.gallons ? num(s.gallons, 1) : '—') },
        { label: 'Fuel cost', help: 'Diesel and DEF', value: s => money(s.fuel) },
        { label: 'MPG', help: 'ELD miles ÷ gallons', value: s => num(derived(s).mpg, 2) },
        { label: 'Fuel per mile', value: s => perMile(derived(s).fuelPerMile) },
      ],
    },
    {
      title: 'Costs & profit',
      lines: [
        ...(tab === 'company_owner' ? [] : [{ label: PAY_LABEL_BY_TAB[tab], value: (s: Stat) => money(s.driverPay) }]),
        ...costRows.map(r => ({ label: r.label, value: (s: Stat) => money(s.costs[r.key] ?? 0) })),
        { label: 'Total costs', help: tab === 'company' ? 'Driver pay plus every deduction' : "The truck's deductions (fuel, insurance, ...)", value: s => money(s.totalCosts), strong: true },
        { label: 'Cost per mile', help: 'Per ELD mile when known, else per loaded mile', value: s => perMile(derived(s).costPerMile) },
        { label: PROFIT_LABEL[tab], help: PROFIT_HELP[tab], value: s => money(s.profit), strong: true, color: s => signColor(s.profit) },
        { label: 'Profit per mile', value: s => perMile(derived(s).profitPerMile), color: s => signColor(derived(s).profitPerMile) },
        { label: 'Margin', help: `${PROFIT_LABEL[tab]} ÷ gross`, value: s => pct(derived(s).margin), color: s => signColor(derived(s).margin) },
      ],
    },
  ]

  const border = '1px solid var(--monday-border-light)'
  const LABEL_W = 210
  const COL_W = 130
  const stickyLabel: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, width: LABEL_W, minWidth: LABEL_W, borderRight: border, borderBottom: border }
  const cell: React.CSSProperties = { width: COL_W, minWidth: COL_W, borderRight: border, borderBottom: border, fontSize: '13px', textAlign: 'right' }

  if (model.driversLoading || model.payrollLoading || model.layoutLoading) {
    return <div className="py-16 text-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Loading weekly report…</div>
  }

  return (
    <div className="space-y-5">
      {/* Week picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Week</span>
        <Button variant="outline" size="sm" aria-label="Previous week" disabled={selectedWeek <= 1} onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
          <SelectTrigger className="w-[300px]" style={{ fontSize: '14px', fontWeight: 500 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[360px]">
            {weeks.map(w => (
              <SelectItem key={w.weekNumber} value={String(w.weekNumber)}>
                {weekOptionLabel(w)}{w.weekNumber === currentWeekNumber(weeks) ? ' (this week)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" aria-label="Next week" disabled={selectedWeek >= weeks.length} onClick={() => setSelectedWeek(w => Math.min(weeks.length, w + 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSelectedWeek(currentWeekNumber(weeks) ?? 1)}>This week</Button>
      </div>

      {/* Driver type tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 transition-all"
            style={{
              color: tab === key ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
              borderBottom: tab === key ? '3px solid var(--monday-done)' : '3px solid transparent',
              marginBottom: '-1px',
              fontWeight: tab === key ? 600 : 500,
              fontSize: '14px',
            }}
          >
            {label}
            <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.7 }}>({columnsFor(selectedWeek, key).length})</span>
          </button>
        ))}
      </div>

      {/* The week at a glance, against the week before */}
      <WeekSummary
        title={`Week ${selectedWeek}`}
        subtitle={week ? `${fmtShort(week.startDate)} – ${week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${TAB_BY_KEY[tab].label}` : ''}
        tab={tab}
        s={total}
        prev={prev}
      />

      {columns.length === 0 ? (
        <div className="rounded-lg py-12 text-center text-sm" style={{ border, color: 'var(--monday-text-secondary)' }}>
          No {TAB_BY_KEY[tab].noun} with loads in week {selectedWeek}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-secondary)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>
                  Week {selectedWeek} · {columns.length} {TAB_BY_KEY[tab].noun}
                </th>
                <th className="px-3 py-2.5" style={{ ...cell, fontWeight: 600, backgroundColor: 'var(--monday-bg-tertiary, var(--monday-bg-secondary))' }}>Total</th>
                {columns.map(d => {
                  const truck = truckNumber(truckOf(d.driver_id, selectedWeek))
                  return (
                    <th key={d.driver_id} className="px-3 py-2" style={{ ...cell, fontWeight: 600 }}>
                      <div className="truncate" title={d.driver_name}>{d.driver_name}</div>
                      <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--monday-text-secondary)' }}>{truck ? `Truck ${truck}` : 'No truck'}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <React.Fragment key={g.title}>
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="px-3 pt-4 pb-1.5"
                      style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--monday-text-secondary)', borderBottom: border }}
                    >
                      <span style={{ position: 'sticky', left: 12 }}>{g.title}</span>
                    </td>
                  </tr>
                  {g.lines.map(line => (
                    <tr key={line.label}>
                      <td className="px-3 py-1.5" style={{ ...stickyLabel, backgroundColor: 'var(--monday-bg-primary)', fontSize: '13px', fontWeight: line.strong ? 600 : 400 }} title={line.help}>
                        {line.label}
                        {line.help && <span style={{ marginLeft: 4, color: 'var(--monday-text-muted)', fontSize: '11px', cursor: 'help' }}>ⓘ</span>}
                      </td>
                      <td className="px-3 py-1.5" style={{ ...cell, fontWeight: 600, color: line.color?.(total), backgroundColor: 'var(--monday-bg-secondary)' }}>{line.value(total)}</td>
                      {stats.map(({ d, s }) => (
                        <td key={d.driver_id} className="px-3 py-1.5" style={{ ...cell, fontWeight: line.strong ? 600 : 400, color: line.color?.(s) }}>
                          {line.value(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>
        Gross, pay and deductions are Payroll&apos;s numbers for the week. Per-mile figures use ELD miles when the truck has them, else loaded miles.
      </p>
    </div>
  )
}

function Delta({ now, before, invert, asPct }: { now: number | null; before: number | null; invert?: boolean; asPct?: boolean }) {
  if (now == null || before == null) return null
  const diff = now - before
  if (Math.abs(diff) < 1e-9) return <span style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>same as last week</span>
  const good = invert ? diff < 0 : diff > 0
  const text = asPct
    ? `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)} pts`
    : before ? `${diff > 0 ? '+' : ''}${((diff / Math.abs(before)) * 100).toFixed(0)}%` : diff > 0 ? 'up' : 'down'
  return <span style={{ fontSize: '12px', fontWeight: 500, color: good ? GREEN : RED }}>{text} vs last week</span>
}

// Deltas compare figures last week can have too (ELD miles are read for the week on screen only).
function WeekSummary({ title, subtitle, tab, s, prev }: { title: string; subtitle: string; tab: DriverTab; s: Stat; prev: Stat | null }) {
  const d = derived(s)
  const p = prev ? derived(prev) : null
  const tiles: { label: string; value: string; color?: string; delta?: React.ReactNode }[] = [
    { label: 'Gross', value: money(s.gross), delta: <Delta now={s.gross} before={prev?.gross ?? null} /> },
    { label: PROFIT_LABEL[tab], value: money(s.profit), color: signColor(s.profit), delta: <Delta now={s.profit} before={prev?.profit ?? null} /> },
    { label: 'Margin', value: pct(d.margin), delta: <Delta now={d.margin} before={p?.margin ?? null} asPct /> },
    { label: 'Loads', value: num(s.loads), delta: <Delta now={s.loads} before={prev?.loads ?? null} /> },
    { label: 'Rate per loaded mile', value: perMile(d.rpm), delta: <Delta now={d.rpm} before={p?.rpm ?? null} /> },
    { label: 'Cost per mile', value: perMile(d.costPerMile) },
    { label: 'Deadhead', value: pct(d.deadheadPct), color: (d.deadheadPct ?? 0) > 0.15 ? RED : undefined },
    { label: 'MPG', value: num(d.mpg, 2) },
  ]
  return (
    <div className="rounded-lg shadow-sm p-4" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{title}</span>
        <span style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>{subtitle}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-md p-3" style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: t.color || 'var(--monday-text-primary)', marginTop: '2px' }}>{t.value}</div>
            {t.delta}
          </div>
        ))}
      </div>
    </div>
  )
}
