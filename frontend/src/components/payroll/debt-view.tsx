'use client'

import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronDown, ChevronRight, HandCoins, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  useAddDebtEntry, useDeleteDebtEntry, useDriverDebts, useSetDebtPlan,
  type DebtHistoryItem, type DriverDebt,
} from '@/hooks/use-driver-debts'

const TYPE_LABEL: Record<string, string> = {
  company: 'Company driver',
  owner_operator: 'Owner operator',
  company_owner: 'Company owner',
}

// "2026-09-16" -> "Sep 16, 2026" without a timezone shift.
const fmtDate = (iso: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const todayIso = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const describe = (h: DebtHistoryItem) => {
  if (h.kind === 'debt') return h.note ? `Debt: ${h.note}` : 'Debt'
  if (h.kind === 'payment') return h.note ? `Payment: ${h.note}` : 'Payment'
  if (h.kind === 'unpaid') return h.note || 'Unpaid fixed deductions (no gross)'
  const [, wk] = (h.week || '').split('-')
  return Number(h.amount) < 0 ? `Payroll week ${wk} (added to debt)` : `Taken from pay, week ${wk}`
}

export function DebtView({ drivers }: { drivers: any[] }) {
  const { data, isLoading } = useDriverDebts()
  const setPlan = useSetDebtPlan()
  const deleteEntry = useDeleteDebtEntry()
  const [showPaidOff, setShowPaidOff] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [dialog, setDialog] = useState<{ kind: 'debt' | 'payment'; driverId?: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [weeklyDraft, setWeeklyDraft] = useState<Record<number, string>>({})

  const rows = useMemo(() => {
    const all = data?.drivers || []
    return showPaidOff ? all : all.filter(d => Number(d.balance) !== 0)
  }, [data, showPaidOff])
  const owing = (data?.drivers || []).filter(d => Number(d.balance) > 0)
  const totalOwed = owing.reduce((s, d) => s + Number(d.balance), 0)
  const paidOffCount = (data?.drivers || []).filter(d => Number(d.balance) === 0).length

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const saveWeekly = (d: DriverDebt) => {
    const raw = weeklyDraft[d.driver_id]
    if (raw === undefined) return
    const value = Math.max(0, Math.round((parseFloat(raw) || 0) * 100) / 100)
    setWeeklyDraft(w => { const n = { ...w }; delete n[d.driver_id]; return n })
    if (value !== Number(d.weekly_amount)) setPlan.mutate({ driver_id: d.driver_id, weekly_amount: value })
  }

  const border = '1px solid var(--monday-border-light)'
  const th: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', borderBottom: border, textAlign: 'left', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: '13px', color: 'var(--monday-text-primary)', borderBottom: border }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg p-4 min-w-[180px]" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total owed</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: totalOwed > 0 ? 'var(--monday-stuck)' : 'var(--monday-text-primary)' }}>{formatCurrency(totalOwed)}</div>
          </div>
          <div className="rounded-lg p-4 min-w-[180px]" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Drivers owing</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{owing.length}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paidOffCount > 0 && (
            <label className="flex items-center gap-1.5 mr-2" style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
              <input type="checkbox" checked={showPaidOff} onChange={e => setShowPaidOff(e.target.checked)} />
              Show paid off ({paidOffCount})
            </label>
          )}
          <Button variant="outline" onClick={() => setDialog({ kind: 'payment' })} style={{ fontSize: '13px', fontWeight: 500 }}>
            <HandCoins className="h-4 w-4 mr-2" /> Record Payment
          </Button>
          <Button onClick={() => setDialog({ kind: 'debt' })} style={{ backgroundColor: 'var(--monday-done)', borderColor: 'var(--monday-done)', color: 'white', fontSize: '13px', fontWeight: 500 }}>
            <Plus className="h-4 w-4 mr-2" /> Add Debt
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border, backgroundColor: 'var(--monday-bg-primary)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 860 }}>
          <thead style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
            <tr>
              <th className="px-3 py-2.5" style={{ ...th, width: 32 }}></th>
              <th className="px-3 py-2.5" style={th}>Driver</th>
              <th className="px-3 py-2.5" style={th}>Owes</th>
              <th className="px-3 py-2.5" style={th}>Total borrowed</th>
              <th className="px-3 py-2.5" style={th}>Paid back</th>
              <th className="px-3 py-2.5" style={th} title="Taken out of pay each week on the Payroll page's Debt Payment row, never more than what's owed">Weekly deduction</th>
              <th className="px-3 py-2.5" style={th}>Last payment</th>
              <th className="px-3 py-2.5" style={th}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center" style={{ ...td, color: 'var(--monday-text-muted)' }}>Loading...</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center" style={{ ...td, color: 'var(--monday-text-muted)' }}>
                No driver owes money right now. Use Add Debt to record an advance or loan.
              </td></tr>
            )}
            {rows.map(d => {
              const balance = Number(d.balance)
              const open = expanded.has(d.driver_id)
              return (
                <React.Fragment key={d.driver_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2.5" style={td}>
                      <button aria-label={open ? 'Hide history' : 'Show history'} onClick={() => toggle(d.driver_id)}>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5" style={td}>
                      <button className="text-left" onClick={() => toggle(d.driver_id)}>
                        <div style={{ fontWeight: 600 }}>{d.driver_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)' }}>{TYPE_LABEL[d.driver_type] || 'Company driver'}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2.5" style={{ ...td, fontWeight: 700, color: balance > 0 ? 'var(--monday-stuck)' : 'var(--monday-done)' }}>
                      {balance > 0 ? formatCurrency(balance) : balance < 0 ? `${formatCurrency(-balance)} credit` : 'Paid off'}
                    </td>
                    <td className="px-3 py-2.5" style={td}>{formatCurrency(Number(d.total_debt))}</td>
                    <td className="px-3 py-2.5" style={td}>{formatCurrency(Number(d.total_paid))}</td>
                    <td className="px-3 py-2" style={td}>
                      <div className="flex items-center gap-1">
                        <span style={{ color: 'var(--monday-text-muted)' }}>$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={weeklyDraft[d.driver_id] ?? (Number(d.weekly_amount) ? Number(d.weekly_amount).toFixed(2) : '')}
                          onChange={e => setWeeklyDraft(w => ({ ...w, [d.driver_id]: e.target.value }))}
                          onBlur={() => saveWeekly(d)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="h-8 w-28 text-sm"
                        />
                        <span style={{ fontSize: '11px', color: 'var(--monday-text-muted)' }}>/wk</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={td}>
                      {d.last_payment_date ? (
                        <>
                          <div>{fmtDate(d.last_payment_date)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)' }}>{formatCurrency(Number(d.last_payment_amount))}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--monday-text-muted)' }}>No payments yet</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" style={td}>
                      <button className="mr-3 hover:underline" style={{ fontSize: '12px', color: 'var(--monday-done)' }} onClick={() => setDialog({ kind: 'payment', driverId: d.driver_id })}>Payment</button>
                      <button className="hover:underline" style={{ fontSize: '12px', color: 'var(--monday-stuck)' }} onClick={() => setDialog({ kind: 'debt', driverId: d.driver_id })}>Add debt</button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td></td>
                      <td colSpan={7} className="px-3 pb-3 pt-1" style={{ borderBottom: border }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th className="py-1.5 pr-3" style={{ ...th, borderBottom: 'none' }}>Date</th>
                              <th className="py-1.5 pr-3" style={{ ...th, borderBottom: 'none' }}>What</th>
                              <th className="py-1.5 pr-3" style={{ ...th, borderBottom: 'none' }}>Amount</th>
                              <th className="py-1.5 pr-3" style={{ ...th, borderBottom: 'none' }}>Balance after</th>
                              <th style={{ ...th, borderBottom: 'none' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.history.length === 0 && (
                              <tr><td colSpan={5} className="py-2" style={{ fontSize: '12px', color: 'var(--monday-text-muted)' }}>Nothing recorded yet.</td></tr>
                            )}
                            {d.history.map((h, i) => {
                              const amt = Number(h.amount)
                              const addsDebt = h.kind === 'debt' || h.kind === 'unpaid' || amt < 0
                              return (
                                <tr key={`${h.kind}-${h.id ?? h.week}-${i}`} style={{ borderTop: '1px solid var(--monday-border-light)' }}>
                                  <td className="py-1.5 pr-3" style={{ fontSize: '12px' }}>{fmtDate(h.date)}</td>
                                  <td className="py-1.5 pr-3" style={{ fontSize: '12px' }}>{describe(h)}</td>
                                  <td className="py-1.5 pr-3" style={{ fontSize: '12px', fontWeight: 600, color: addsDebt ? 'var(--monday-stuck)' : 'var(--monday-done)' }}>
                                    {addsDebt ? '+' : '−'}{formatCurrency(Math.abs(amt))}
                                  </td>
                                  <td className="py-1.5 pr-3" style={{ fontSize: '12px' }}>{formatCurrency(Number(h.balance))}</td>
                                  <td className="py-1.5 text-right" style={{ fontSize: '12px' }}>
                                    {h.id !== null && (confirmDelete === h.id ? (
                                      <span className="whitespace-nowrap">
                                        <button className="text-red-600 font-semibold mr-2" onClick={() => { deleteEntry.mutate(h.id as number); setConfirmDelete(null) }}>Remove</button>
                                        <button style={{ color: 'var(--monday-text-secondary)' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                                      </span>
                                    ) : (
                                      <button aria-label="Remove entry" onClick={() => setConfirmDelete(h.id)} className="rounded p-0.5 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                      </button>
                                    ))}
                                    {h.kind === 'unpaid' && (
                                      <span style={{ color: 'var(--monday-text-muted)' }} title="Type 0 in that week's cell on the Payroll page to waive it">from payroll</span>
                                    )}
                                    {h.kind === 'payroll' && (
                                      <span style={{ color: 'var(--monday-text-muted)' }} title="Change it on the Payroll page, Debt Payment row">from payroll</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
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

      <EntryDialog
        state={dialog}
        drivers={drivers}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function EntryDialog({ state, drivers, onClose }: {
  state: { kind: 'debt' | 'payment'; driverId?: number } | null
  drivers: any[]
  onClose: () => void
}) {
  const addEntry = useAddDebtEntry()
  const [driverId, setDriverId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(todayIso())
  const [note, setNote] = useState('')

  React.useEffect(() => {
    if (!state) return
    setDriverId(state.driverId ? String(state.driverId) : '')
    setAmount('')
    setEntryDate(todayIso())
    setNote('')
  }, [state])

  const sorted = useMemo(() => [...drivers].sort((a, b) =>
    (a.date_terminated ? 1 : 0) - (b.date_terminated ? 1 : 0) ||
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)), [drivers])

  const isDebt = state?.kind === 'debt'
  const value = Math.round((parseFloat(amount) || 0) * 100) / 100
  const valid = !!driverId && value > 0 && !!entryDate

  const submit = async () => {
    if (!state || !valid) return
    await addEntry.mutateAsync({ driver_id: Number(driverId), kind: state.kind, amount: value, entry_date: entryDate, note: note.trim() || undefined })
      .then(onClose)
      .catch(() => null)
  }

  return (
    <Dialog open={!!state} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDebt ? 'Add debt' : 'Record payment'}</DialogTitle>
          <DialogDescription>
            {isDebt
              ? 'Money the driver owes the company, such as an advance, a loan or damage.'
              : 'A payment made outside payroll, such as cash or a check. Amounts taken from pay are counted automatically from the Debt Payment row.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <select className="h-9 w-full rounded-md border px-2 text-sm" value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">Select a driver</option>
              {sorted.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name}{d.date_terminated ? ' (terminated)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus={!!state?.driverId} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input maxLength={255} placeholder={isDebt ? 'e.g. Cash advance, Truck repair' : 'e.g. Cash, Check #1042'} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || addEntry.isPending} onClick={submit}>{isDebt ? 'Add debt' : 'Record payment'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
