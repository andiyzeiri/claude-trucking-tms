'use client'

import React, { useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useCreateRto, useDeleteRto, useRateToOperate, useUpdateRto, type RtoRow, type RtoSection } from '@/hooks/use-rate-to-operate'

// Stored as rate_to_operate rows, one section per table; total = cost,
// miles = the miles the cost covers (e.g. a set of tires: $3,000 over 100,000 mi).
// Variable Costs keep the 'equipment' section they were saved under as
// Equipment Expenses.
export const COST_TABLES = {
  variable: { section: 'equipment' as RtoSection, defaults: ['Insurance', 'Truck', 'Trailer', 'Maintenance', 'ELD', 'Brakes', 'Tires', 'Tolls'] },
  fixed: { section: 'fixed_cost' as RtoSection, defaults: [] as string[] },
  // Company Costs: the cost is a yearly cost, also shown per week and year to date;
  // cost per mile divides it by one figure, the company's miles for the year
  // (stored as a single rate_to_operate row in section 'company_miles').
  company: { section: 'company_cost' as RtoSection, defaults: [] as string[], yearly: true },
}
const MILES_SECTION = 'company_miles' as RtoSection
const LEGACY_KEY = 'equipmentExpenses' // costs Equipment Expenses used to keep in the browser

const perMile = (r: Pick<RtoRow, 'total' | 'miles'>) => (r.miles > 0 ? r.total / r.miles : null)
const fmtPerMile = (n: number | null) => (n == null ? '—' : `$${n.toFixed(3)}`)
// Share of this calendar year that has passed, through today.
function yearShare(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1)
  const days = (new Date(now.getFullYear() + 1, 0, 1).getTime() - start.getTime()) / 86400000
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1
  return Math.min(1, elapsed / days)
}

/** Reports > Variable Costs / Fixed Costs / Company Costs: each cost and the miles it covers, giving its cost per mile. */
export default function CostTable({ kind }: { kind: keyof typeof COST_TABLES }) {
  const { section: SECTION, defaults: DEFAULTS } = COST_TABLES[kind]
  const yearly = 'yearly' in COST_TABLES[kind]
  const cols = yearly ? 6 : 5
  const { data, isLoading } = useRateToOperate()
  const create = useCreateRto()
  const update = useUpdateRto()
  const remove = useDeleteRto()
  const rows = (data || []).filter(r => r.section === SECTION).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const milesRow = yearly ? (data || []).find(r => r.section === MILES_SECTION) : undefined
  const companyMiles = milesRow?.miles || 0
  // Company Costs: per mile of the company's miles for the year; else per the row's own miles.
  const costPerMile = (r: Pick<RtoRow, 'total' | 'miles'>) => (yearly ? (companyMiles > 0 ? r.total / companyMiles : null) : perMile(r))
  const saveCompanyMiles = (value: number) => {
    if (value === companyMiles) return
    if (milesRow) update.mutate({ id: milesRow.id, data: { miles: value } })
    else create.mutate({ section: MILES_SECTION, expense: 'Company miles for the year', miles: value, total: 0 })
  }

  // First visit: start from the usual categories, with any costs saved in this browser before.
  const seeded = useRef(false)
  useEffect(() => {
    if (isLoading || !data || seeded.current || rows.length || !DEFAULTS.length) return
    seeded.current = true
    let legacy: Record<string, number> = {}
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') || {} } catch { /* none */ }
    DEFAULTS.forEach((expense, i) => create.mutate({ section: SECTION, expense, total: Number(legacy[expense]) || 0, miles: 0, sort_order: i }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data])

  const save = (row: RtoRow, patch: Partial<Pick<RtoRow, 'expense' | 'total' | 'miles'>>) => {
    const next = { ...row, ...patch }
    if (next.expense === row.expense && next.total === row.total && next.miles === row.miles) return
    update.mutate({ id: row.id, data: { ...patch, rate_per_mile: costPerMile(next) ?? 0 } })
  }
  const addRow = () =>
    create.mutate({ section: SECTION, expense: 'New cost', total: 0, miles: 0, sort_order: (rows[rows.length - 1]?.sort_order ?? -1) + 1 })

  const totalCost = rows.reduce((s, r) => s + r.total, 0)
  const ytdShare = yearShare()
  const totalPerMile = yearly ? (companyMiles > 0 ? totalCost / companyMiles : null)
    : rows.some(r => perMile(r) != null) ? rows.reduce((s, r) => s + (perMile(r) ?? 0), 0) : null
  const input = 'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none'
  const enterBlurs = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {yearly && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
          <label htmlFor="company-miles" className="text-sm font-medium text-gray-700">Company miles for the year</label>
          <input
            id="company-miles"
            key={`miles-${milesRow?.id ?? 'new'}-${milesRow?.updated_at || ''}`}
            className="w-40 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
            type="number" step="1" min="0" placeholder="0"
            defaultValue={companyMiles || ''}
            onBlur={e => saveCompanyMiles(Math.round(Number(e.target.value) || 0))}
            onKeyDown={enterBlurs}
          />
          <span className="text-xs text-gray-500">Every expense&apos;s cost per mile is its yearly cost ÷ this number.</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[220px]">Expense</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">{yearly ? 'Yearly cost' : 'Cost'}</th>
              {yearly && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Weekly</th>}
              {yearly && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]" title={`Yearly cost × ${(ytdShare * 100).toFixed(1)}% of the year so far`}>YTD</th>}
              {!yearly && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Miles</th>}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Cost per mile</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {isLoading && (
              <tr><td colSpan={cols} className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-8 text-center text-sm text-gray-500">No costs yet - click Add cost.</td></tr>
            )}
            {rows.map(r => (
              // Re-mount when saved (here or by someone else) so the inputs show the stored values.
              <tr key={`${r.id}-${r.updated_at || ''}`} className="group border-t border-gray-200 hover:bg-gray-50">
                <td className="px-2 py-1.5">
                  <input className={`${input} font-semibold text-gray-900`} defaultValue={r.expense} maxLength={60}
                    onBlur={e => save(r, { expense: e.target.value.trim() || r.expense })} onKeyDown={enterBlurs} />
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} text-right`} type="number" step="0.01" min="0" defaultValue={r.total || ''} placeholder="0.00"
                    onBlur={e => save(r, { total: Number(e.target.value) || 0 })} onKeyDown={enterBlurs} />
                </td>
                {yearly && <td className="px-4 py-1.5 text-right text-sm text-gray-700">{r.total ? formatCurrency(r.total / 52) : '—'}</td>}
                {yearly && <td className="px-4 py-1.5 text-right text-sm text-gray-700">{r.total ? formatCurrency(r.total * ytdShare) : '—'}</td>}
                {!yearly && (
                  <td className="px-2 py-1.5">
                    <input className={`${input} text-right`} type="number" step="1" min="0" defaultValue={r.miles || ''} placeholder="0"
                      onBlur={e => save(r, { miles: Math.round(Number(e.target.value) || 0) })} onKeyDown={enterBlurs} />
                  </td>
                )}
                <td className="px-4 py-1.5 text-right text-sm font-semibold text-gray-700">{fmtPerMile(costPerMile(r))}</td>
                <td className="px-2 py-1.5 text-center">
                  <button type="button" title="Delete" className="text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && (
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-4 py-3 text-sm">Total</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalCost)}</td>
                {yearly && <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalCost / 52)}</td>}
                {yearly && <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalCost * ytdShare)}</td>}
                {!yearly && <td className="px-4 py-3 text-sm text-right text-gray-400">—</td>}
                <td className="px-4 py-3 text-sm text-right" title={yearly ? 'Total yearly cost ÷ company miles' : 'The cost per mile of every expense added together'}>{fmtPerMile(totalPerMile)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          {yearly
            ? `Weekly = yearly cost ÷ 52. YTD = yearly cost × the share of ${new Date().getFullYear()} so far (${(ytdShare * 100).toFixed(1)}%). Cost per mile = yearly cost ÷ company miles for the year. `
            : 'Cost per mile = cost ÷ the miles it covers. '}
          Changes save when you leave the field and are shared with everyone.
        </span>
        <Button size="sm" variant="outline" onClick={addRow} disabled={create.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Add cost
        </Button>
      </div>
    </div>
  )
}
