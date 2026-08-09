'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { LayoutDashboard, Truck, Receipt, Landmark, ChevronDown } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'
import { useFuel } from '@/hooks/use-fuel'
import { useExpenses } from '@/hooks/use-expenses'
import type { Load, Expense, Fuel } from '@/types'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trips', label: 'Trips', icon: Truck },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'receivables', label: 'Receivables', icon: Landmark },
] as const

type TabId = typeof TABS[number]['id']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Revenue is linehaul `rate`, matching how the loads page totals its group
// rows. Adjustments are reported separately so the two pages reconcile.
const revenueOf = (l: Load) => Number(l.rate) || 0
const milesOf = (l: Load) => Number(l.miles) || 0
const adjustmentOf = (l: Load) => Number(l.adjustment_amount) || 0

// delivery_date is the accounting date for a trip - it is when the revenue was
// earned. Loads without one are excluded from every period figure.
const monthIndex = (date?: string | null) => {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d.getMonth()
}
const yearOf = (date?: string | null) => {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d.getFullYear()
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

// The Load type's status union is stale - it still lists pending/assigned/
// in_transit/delivered/cancelled, while the database only ever holds
// available, dispatched, or invoiced. Compared through the real value here
// rather than editing the shared type, which would break the dead badge
// logic in ratecons/page.tsx.
const isInvoiced = (l: Load) => (l.status as string) === 'invoiced'

export default function AccountingPage() {
  const [tab, setTab] = useState<TabId>('overview')
  const [year, setYear] = useState<number>(new Date().getFullYear())

  const { data: loadsData, isLoading: loadsLoading } = useLoads(1, 10000)
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const { data: expenseData, isLoading: expensesLoading } = useExpenses(1, 10000)

  const allLoads = useMemo(() => loadsData?.items ?? [], [loadsData])
  const allFuel = useMemo(() => fuelData ?? [], [fuelData])
  const allExpenses = useMemo(() => expenseData?.items ?? [], [expenseData])

  const isLoading = loadsLoading || fuelLoading || expensesLoading

  // Years come from the data itself, so the dropdown never offers an empty
  // year. The current year is always included even before it has any loads.
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()])
    allLoads.forEach((l) => { const y = yearOf(l.delivery_date); if (y) set.add(y) })
    allFuel.forEach((f) => { const y = yearOf(f.date); if (y) set.add(y) })
    allExpenses.forEach((e) => { const y = yearOf(e.date); if (y) set.add(y) })
    return Array.from(set).sort((a, b) => b - a)
  }, [allLoads, allFuel, allExpenses])

  const loads = useMemo(
    () => allLoads.filter((l) => yearOf(l.delivery_date) === year),
    [allLoads, year]
  )
  const fuel = useMemo(
    () => allFuel.filter((f) => yearOf(f.date) === year),
    [allFuel, year]
  )
  const expenses = useMemo(
    () => allExpenses.filter((e) => yearOf(e.date) === year),
    [allExpenses, year]
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
              Accounting
            </h1>
            <p className="text-sm" style={{ color: 'var(--monday-text-muted)' }}>
              Revenue, cost, and receivables for {year}
            </p>
          </div>

          <div className="relative">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="appearance-none rounded-md border pl-3 pr-9 py-2 text-sm font-semibold cursor-pointer"
              style={{
                borderColor: 'var(--monday-border-light)',
                color: 'var(--monday-text-primary)',
                backgroundColor: '#FFFFFF',
              }}
              aria-label="Filter by year"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown
              className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--monday-text-muted)' }}
            />
          </div>
        </div>

        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: active ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
                  borderBottom: active ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
                }}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-sm" style={{ color: 'var(--monday-text-muted)' }}>
            Loading&hellip;
          </CardContent></Card>
        ) : (
          <>
            {tab === 'overview' && <Overview loads={loads} fuel={fuel} expenses={expenses} year={year} />}
            {tab === 'trips' && <Trips loads={loads} />}
            {tab === 'expenses' && <Expenses fuel={fuel} expenses={expenses} />}
            {tab === 'receivables' && <Receivables loads={loads} year={year} />}
          </>
        )}
      </div>
    </Layout>
  )
}

// --------------------------------------------------------------------------
// Shared presentation
// --------------------------------------------------------------------------

function Kpi({ label, value, sub, tone }: {
  label: string
  value: string
  sub?: string
  tone?: 'revenue' | 'cost' | 'net' | 'neutral'
}) {
  const color =
    tone === 'revenue' ? '#008000'
    : tone === 'cost' ? '#B91C1C'
    : tone === 'net' ? 'var(--monday-cornflower)'
    : 'var(--monday-text-primary)'
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--monday-text-muted)' }}>
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: 'var(--monday-text-muted)' }}>{sub}</div>}
      </CardContent>
    </Card>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
      style={{ textAlign: align, color: 'var(--monday-text-secondary)' }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', bold, color }: {
  children: React.ReactNode
  align?: 'left' | 'right'
  bold?: boolean
  color?: string
}) {
  return (
    <td
      className={`px-4 py-2 text-sm tabular-nums ${bold ? 'font-semibold' : ''}`}
      style={{ textAlign: align, color: color ?? 'var(--monday-text-primary)' }}
    >
      {children}
    </td>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card><CardContent className="py-12 text-center text-sm" style={{ color: 'var(--monday-text-muted)' }}>
      {children}
    </CardContent></Card>
  )
}

// Header row of every table on the page.
const headRowStyle: React.CSSProperties = { backgroundColor: '#F8F9FA' }
const totalRowStyle: React.CSSProperties = { backgroundColor: '#EDF2FB' }

// --------------------------------------------------------------------------
// Overview
// --------------------------------------------------------------------------

function Overview({ loads, fuel, expenses, year }: {
  loads: Load[]; fuel: Fuel[]; expenses: Expense[]; year: number
}) {
  const s = useMemo(() => {
    const revenue = loads.reduce((a, l) => a + revenueOf(l), 0)
    const adjustments = loads.reduce((a, l) => a + adjustmentOf(l), 0)
    const miles = loads.reduce((a, l) => a + milesOf(l), 0)
    const fuelCost = fuel.reduce((a, f) => a + (Number(f.total_amount) || 0), 0)
    const otherCost = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
    const cost = fuelCost + otherCost
    return {
      revenue, adjustments, miles, fuelCost, otherCost, cost,
      net: revenue + adjustments - cost,
      trips: loads.length,
    }
  }, [loads, fuel, expenses])

  const monthly = useMemo(() => {
    const rows = MONTHS.map((m) => ({
      month: m, trips: 0, miles: 0, revenue: 0, fuel: 0, other: 0,
    }))
    loads.forEach((l) => {
      const i = monthIndex(l.delivery_date); if (i === null) return
      rows[i].trips += 1
      rows[i].miles += milesOf(l)
      rows[i].revenue += revenueOf(l) + adjustmentOf(l)
    })
    fuel.forEach((f) => {
      const i = monthIndex(f.date); if (i === null) return
      rows[i].fuel += Number(f.total_amount) || 0
    })
    expenses.forEach((e) => {
      const i = monthIndex(e.date); if (i === null) return
      rows[i].other += Number(e.amount) || 0
    })
    return rows
  }, [loads, fuel, expenses])

  if (!loads.length && !fuel.length && !expenses.length) {
    return <Empty>No activity recorded in {year}.</Empty>
  }

  const margin = pct(s.net, s.revenue + s.adjustments)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Revenue" tone="revenue" value={formatCurrency(s.revenue)}
             sub={`${s.trips.toLocaleString()} trips${s.adjustments ? ` · ${formatCurrency(s.adjustments)} adjustments` : ''}`} />
        <Kpi label="Expenses" tone="cost" value={formatCurrency(s.cost)}
             sub={`${formatCurrency(s.fuelCost)} fuel · ${formatCurrency(s.otherCost)} other`} />
        <Kpi label="Net" tone="net" value={formatCurrency(s.net)}
             sub={`${margin.toFixed(1)}% margin`} />
        <Kpi label="Revenue / mile" value={s.miles > 0 ? `$${(s.revenue / s.miles).toFixed(2)}` : '—'}
             sub={`${s.miles.toLocaleString()} miles`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly summary</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Month</Th><Th align="right">Trips</Th><Th align="right">Miles</Th>
              <Th align="right">Revenue</Th><Th align="right">Fuel</Th>
              <Th align="right">Other</Th><Th align="right">Net</Th>
            </tr></thead>
            <tbody>
              {monthly.map((r) => {
                const net = r.revenue - r.fuel - r.other
                const idle = !r.trips && !r.fuel && !r.other
                return (
                  <tr key={r.month} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                    <Td bold>{r.month}</Td>
                    <Td align="right" color={idle ? 'var(--monday-text-muted)' : undefined}>{r.trips || '—'}</Td>
                    <Td align="right" color={idle ? 'var(--monday-text-muted)' : undefined}>{r.miles ? r.miles.toLocaleString() : '—'}</Td>
                    <Td align="right" color={r.revenue ? '#008000' : 'var(--monday-text-muted)'} bold={!!r.revenue}>
                      {r.revenue ? formatCurrency(r.revenue) : '—'}
                    </Td>
                    <Td align="right" color={r.fuel ? '#B91C1C' : 'var(--monday-text-muted)'}>{r.fuel ? formatCurrency(r.fuel) : '—'}</Td>
                    <Td align="right" color={r.other ? '#B91C1C' : 'var(--monday-text-muted)'}>{r.other ? formatCurrency(r.other) : '—'}</Td>
                    <Td align="right" bold color={idle ? 'var(--monday-text-muted)' : net >= 0 ? '#008000' : '#B91C1C'}>
                      {idle ? '—' : formatCurrency(net)}
                    </Td>
                  </tr>
                )
              })}
              <tr className="border-t-2" style={{ ...totalRowStyle, borderColor: '#CBD5E1' }}>
                <Td bold>Total</Td>
                <Td align="right" bold>{s.trips.toLocaleString()}</Td>
                <Td align="right" bold>{s.miles.toLocaleString()}</Td>
                <Td align="right" bold color="#008000">{formatCurrency(s.revenue + s.adjustments)}</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(s.fuelCost)}</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(s.otherCost)}</Td>
                <Td align="right" bold color={s.net >= 0 ? '#008000' : '#B91C1C'}>{formatCurrency(s.net)}</Td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------
// Trips
// --------------------------------------------------------------------------

function Trips({ loads }: { loads: Load[] }) {
  const monthly = useMemo(() => {
    const rows = MONTHS.map((m) => ({ month: m, trips: 0, miles: 0, revenue: 0 }))
    loads.forEach((l) => {
      const i = monthIndex(l.delivery_date); if (i === null) return
      rows[i].trips += 1
      rows[i].miles += milesOf(l)
      rows[i].revenue += revenueOf(l)
    })
    return rows
  }, [loads])

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; trips: number; miles: number; revenue: number }>()
    loads.forEach((l) => {
      const name = l.customer?.name ?? 'Unassigned'
      const row = map.get(name) ?? { name, trips: 0, miles: 0, revenue: 0 }
      row.trips += 1
      row.miles += milesOf(l)
      row.revenue += revenueOf(l)
      map.set(name, row)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [loads])

  const totals = useMemo(() => ({
    trips: loads.length,
    miles: loads.reduce((a, l) => a + milesOf(l), 0),
    revenue: loads.reduce((a, l) => a + revenueOf(l), 0),
  }), [loads])

  if (!loads.length) return <Empty>No trips recorded for this year.</Empty>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Trips" value={totals.trips.toLocaleString()} />
        <Kpi label="Miles" value={totals.miles.toLocaleString()} />
        <Kpi label="Revenue" tone="revenue" value={formatCurrency(totals.revenue)} />
        <Kpi label="Rate / mile"
             value={totals.miles > 0 ? `$${(totals.revenue / totals.miles).toFixed(2)}` : '—'}
             sub={totals.trips > 0 ? `${formatCurrency(totals.revenue / totals.trips)} per trip` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Trips by month</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Month</Th><Th align="right">Trips</Th><Th align="right">Miles</Th>
              <Th align="right">Revenue</Th><Th align="right">$ / mi</Th><Th align="right">Avg / trip</Th>
            </tr></thead>
            <tbody>
              {monthly.map((r) => (
                <tr key={r.month} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                  <Td bold>{r.month}</Td>
                  <Td align="right" color={r.trips ? undefined : 'var(--monday-text-muted)'}>{r.trips || '—'}</Td>
                  <Td align="right" color={r.miles ? undefined : 'var(--monday-text-muted)'}>{r.miles ? r.miles.toLocaleString() : '—'}</Td>
                  <Td align="right" bold={!!r.revenue} color={r.revenue ? '#008000' : 'var(--monday-text-muted)'}>
                    {r.revenue ? formatCurrency(r.revenue) : '—'}
                  </Td>
                  <Td align="right" color={r.miles ? 'var(--monday-purple)' : 'var(--monday-text-muted)'}>
                    {r.miles > 0 ? `$${(r.revenue / r.miles).toFixed(2)}` : '—'}
                  </Td>
                  <Td align="right" color={r.trips ? undefined : 'var(--monday-text-muted)'}>
                    {r.trips > 0 ? formatCurrency(r.revenue / r.trips) : '—'}
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ ...totalRowStyle, borderColor: '#CBD5E1' }}>
                <Td bold>Total</Td>
                <Td align="right" bold>{totals.trips.toLocaleString()}</Td>
                <Td align="right" bold>{totals.miles.toLocaleString()}</Td>
                <Td align="right" bold color="#008000">{formatCurrency(totals.revenue)}</Td>
                <Td align="right" bold color="var(--monday-purple)">
                  {totals.miles > 0 ? `$${(totals.revenue / totals.miles).toFixed(2)}` : '—'}
                </Td>
                <Td align="right" bold>{totals.trips > 0 ? formatCurrency(totals.revenue / totals.trips) : '—'}</Td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue by customer</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Customer</Th><Th align="right">Trips</Th><Th align="right">Miles</Th>
              <Th align="right">Revenue</Th><Th align="right">$ / mi</Th><Th align="right">% of total</Th>
            </tr></thead>
            <tbody>
              {byCustomer.map((c) => (
                <tr key={c.name} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                  <Td bold color="#69140E">{c.name}</Td>
                  <Td align="right">{c.trips.toLocaleString()}</Td>
                  <Td align="right">{c.miles.toLocaleString()}</Td>
                  <Td align="right" bold color="#008000">{formatCurrency(c.revenue)}</Td>
                  <Td align="right" color="var(--monday-purple)">
                    {c.miles > 0 ? `$${(c.revenue / c.miles).toFixed(2)}` : '—'}
                  </Td>
                  <Td align="right" color="var(--monday-text-muted)">{pct(c.revenue, totals.revenue).toFixed(1)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------
// Expenses
// --------------------------------------------------------------------------

function Expenses({ fuel, expenses }: { fuel: Fuel[]; expenses: Expense[] }) {
  const fuelTotal = useMemo(() => fuel.reduce((a, f) => a + (Number(f.total_amount) || 0), 0), [fuel])
  const gallons = useMemo(() => fuel.reduce((a, f) => a + (Number(f.gallons) || 0), 0), [fuel])
  const otherTotal = useMemo(() => expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0), [expenses])
  const total = fuelTotal + otherTotal

  // Fuel lives in its own table rather than as an expense category, so it is
  // added here as a synthetic row to make the breakdown add up to the total.
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; count: number; amount: number }>()
    if (fuel.length) map.set('Fuel', { name: 'Fuel', count: fuel.length, amount: fuelTotal })
    expenses.forEach((e) => {
      const name = e.category || 'Uncategorized'
      const row = map.get(name) ?? { name, count: 0, amount: 0 }
      row.count += 1
      row.amount += Number(e.amount) || 0
      map.set(name, row)
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [fuel, expenses, fuelTotal])

  const monthly = useMemo(() => {
    const rows = MONTHS.map((m) => ({ month: m, fuel: 0, other: 0 }))
    fuel.forEach((f) => {
      const i = monthIndex(f.date); if (i === null) return
      rows[i].fuel += Number(f.total_amount) || 0
    })
    expenses.forEach((e) => {
      const i = monthIndex(e.date); if (i === null) return
      rows[i].other += Number(e.amount) || 0
    })
    return rows
  }, [fuel, expenses])

  if (!fuel.length && !expenses.length) return <Empty>No expenses recorded for this year.</Empty>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Total expenses" tone="cost" value={formatCurrency(total)} />
        <Kpi label="Fuel" tone="cost" value={formatCurrency(fuelTotal)}
             sub={`${pct(fuelTotal, total).toFixed(0)}% of spend`} />
        <Kpi label="Other" tone="cost" value={formatCurrency(otherTotal)}
             sub={`${expenses.length} entries`} />
        <Kpi label="Avg $ / gallon"
             value={gallons > 0 ? `$${(fuelTotal / gallons).toFixed(3)}` : '—'}
             sub={gallons > 0 ? `${gallons.toLocaleString(undefined, { maximumFractionDigits: 0 })} gallons` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Category</Th><Th align="right">Entries</Th><Th align="right">Amount</Th><Th align="right">% of total</Th>
            </tr></thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.name} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                  <Td bold>{c.name}</Td>
                  <Td align="right">{c.count.toLocaleString()}</Td>
                  <Td align="right" bold color="#B91C1C">{formatCurrency(c.amount)}</Td>
                  <Td align="right" color="var(--monday-text-muted)">{pct(c.amount, total).toFixed(1)}%</Td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ ...totalRowStyle, borderColor: '#CBD5E1' }}>
                <Td bold>Total</Td>
                <Td align="right" bold>{(fuel.length + expenses.length).toLocaleString()}</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(total)}</Td>
                <Td align="right" bold>100%</Td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By month</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Month</Th><Th align="right">Fuel</Th><Th align="right">Other</Th><Th align="right">Total</Th>
            </tr></thead>
            <tbody>
              {monthly.map((r) => {
                const t = r.fuel + r.other
                return (
                  <tr key={r.month} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                    <Td bold>{r.month}</Td>
                    <Td align="right" color={r.fuel ? '#B91C1C' : 'var(--monday-text-muted)'}>{r.fuel ? formatCurrency(r.fuel) : '—'}</Td>
                    <Td align="right" color={r.other ? '#B91C1C' : 'var(--monday-text-muted)'}>{r.other ? formatCurrency(r.other) : '—'}</Td>
                    <Td align="right" bold color={t ? '#B91C1C' : 'var(--monday-text-muted)'}>{t ? formatCurrency(t) : '—'}</Td>
                  </tr>
                )
              })}
              <tr className="border-t-2" style={{ ...totalRowStyle, borderColor: '#CBD5E1' }}>
                <Td bold>Total</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(fuelTotal)}</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(otherTotal)}</Td>
                <Td align="right" bold color="#B91C1C">{formatCurrency(total)}</Td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------
// Receivables
// --------------------------------------------------------------------------

const BUCKETS = [
  { key: '0-30', label: '0 – 30 days', min: 0, max: 30 },
  { key: '31-60', label: '31 – 60 days', min: 31, max: 60 },
  { key: '61-90', label: '61 – 90 days', min: 61, max: 90 },
  { key: '90+', label: '90+ days', min: 91, max: Infinity },
] as const

const daysSince = (date?: string | null) => {
  if (!date) return 0
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}

function Receivables({ loads, year }: { loads: Load[]; year: number }) {
  // A load is a receivable once it has been invoiced. Nothing in the schema
  // records payment, so an invoiced load stays outstanding indefinitely.
  const open = useMemo(() => loads.filter(isInvoiced), [loads])

  const total = useMemo(() => open.reduce((a, l) => a + revenueOf(l) + adjustmentOf(l), 0), [open])

  const aged = useMemo(() => BUCKETS.map((b) => {
    const rows = open.filter((l) => {
      const d = daysSince(l.delivery_date)
      return d >= b.min && d <= b.max
    })
    return { ...b, count: rows.length, amount: rows.reduce((a, l) => a + revenueOf(l) + adjustmentOf(l), 0) }
  }), [open])

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; count: number; amount: number; oldest: number }>()
    open.forEach((l) => {
      const name = l.customer?.name ?? 'Unassigned'
      const row = map.get(name) ?? { name, count: 0, amount: 0, oldest: 0 }
      row.count += 1
      row.amount += revenueOf(l) + adjustmentOf(l)
      row.oldest = Math.max(row.oldest, daysSince(l.delivery_date))
      map.set(name, row)
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [open])

  const oldest = useMemo(
    () => [...open].sort((a, b) => daysSince(b.delivery_date) - daysSince(a.delivery_date)).slice(0, 15),
    [open]
  )

  if (!open.length) return <Empty>No invoiced loads in {year}.</Empty>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Outstanding" tone="revenue" value={formatCurrency(total)}
             sub={`${open.length.toLocaleString()} invoiced loads`} />
        {aged.slice(1).map((b) => (
          <Kpi key={b.key} label={b.label} value={formatCurrency(b.amount)}
               sub={`${b.count.toLocaleString()} loads`}
               tone={b.key === '90+' && b.amount > 0 ? 'cost' : 'neutral'} />
        ))}
      </div>

      <div
        className="rounded-md px-4 py-3 text-sm"
        style={{ backgroundColor: '#FEFDEB', color: 'var(--monday-text-secondary)' }}
      >
        Aging counts every invoiced load as outstanding, because nothing in the system
        records that a customer has paid. Add a paid date to loads and these figures
        become true A/R.
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Aging</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Age</Th><Th align="right">Loads</Th><Th align="right">Amount</Th><Th align="right">% of total</Th>
            </tr></thead>
            <tbody>
              {aged.map((b) => (
                <tr key={b.key} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                  <Td bold>{b.label}</Td>
                  <Td align="right" color={b.count ? undefined : 'var(--monday-text-muted)'}>{b.count || '—'}</Td>
                  <Td align="right" bold={!!b.amount}
                      color={!b.amount ? 'var(--monday-text-muted)' : b.key === '90+' ? '#B91C1C' : '#008000'}>
                    {b.amount ? formatCurrency(b.amount) : '—'}
                  </Td>
                  <Td align="right" color="var(--monday-text-muted)">{pct(b.amount, total).toFixed(1)}%</Td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ ...totalRowStyle, borderColor: '#CBD5E1' }}>
                <Td bold>Total</Td>
                <Td align="right" bold>{open.length.toLocaleString()}</Td>
                <Td align="right" bold color="#008000">{formatCurrency(total)}</Td>
                <Td align="right" bold>100%</Td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By customer</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Customer</Th><Th align="right">Loads</Th><Th align="right">Outstanding</Th>
              <Th align="right">Oldest</Th><Th align="right">% of total</Th>
            </tr></thead>
            <tbody>
              {byCustomer.map((c) => (
                <tr key={c.name} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                  <Td bold color="#69140E">{c.name}</Td>
                  <Td align="right">{c.count.toLocaleString()}</Td>
                  <Td align="right" bold color="#008000">{formatCurrency(c.amount)}</Td>
                  <Td align="right" color={c.oldest > 90 ? '#B91C1C' : 'var(--monday-text-secondary)'}>{c.oldest} d</Td>
                  <Td align="right" color="var(--monday-text-muted)">{pct(c.amount, total).toFixed(1)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Oldest outstanding</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full">
            <thead><tr style={headRowStyle}>
              <Th>Load</Th><Th>Customer</Th><Th>Delivered</Th>
              <Th align="right">Age</Th><Th align="right">Amount</Th>
            </tr></thead>
            <tbody>
              {oldest.map((l) => {
                const age = daysSince(l.delivery_date)
                return (
                  <tr key={l.id} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                    <Td bold>{l.load_number}</Td>
                    <Td bold color="#69140E">{l.customer?.name ?? 'Unassigned'}</Td>
                    <Td color="var(--monday-text-secondary)">
                      {l.delivery_date ? new Date(l.delivery_date).toLocaleDateString() : '—'}
                    </Td>
                    <Td align="right" bold color={age > 90 ? '#B91C1C' : 'var(--monday-text-secondary)'}>{age} d</Td>
                    <Td align="right" bold color="#008000">{formatCurrency(revenueOf(l) + adjustmentOf(l))}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
