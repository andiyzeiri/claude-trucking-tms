'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, BookOpen, Scale, FileText, Settings2, Trash2, Check, Undo2, X
} from 'lucide-react'
import {
  useAccounts, useCreateAccount, useDeleteAccount,
  useJournalEntries, useCreateJournalEntry, usePostJournalEntry,
  useReverseJournalEntry, useDeleteJournalEntry,
  useTrialBalance, useIncomeStatement, useBalanceSheet,
  useAccountingMappings, useUpsertMapping,
  num,
  type AccountType, type JournalLineInput, type MappingEvent, type Account,
} from '@/hooks/use-accounting'

const TABS = [
  { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
  { id: 'journal', label: 'Journal Entries', icon: FileText },
  { id: 'trial', label: 'Trial Balance', icon: Scale },
  { id: 'statements', label: 'Statements', icon: FileText },
  { id: 'mappings', label: 'Auto-Post', icon: Settings2 },
] as const

type TabId = typeof TABS[number]['id']

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

// Mirrors the backend's EVENT_DESCRIPTIONS so the UI explains what each
// mapping actually posts.
const EVENTS: { key: MappingEvent; label: string; debit: string; credit: string }[] = [
  { key: 'invoice', label: 'Invoices', debit: 'Accounts Receivable', credit: 'Revenue' },
  { key: 'fuel', label: 'Fuel', debit: 'Fuel Expense', credit: 'Cash / A/P' },
  { key: 'expense', label: 'Expenses', debit: 'Operating Expense', credit: 'Cash / A/P' },
  { key: 'payroll', label: 'Payroll', debit: 'Driver Wages', credit: 'Cash / Payroll Liability' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function AccountingPage() {
  const [tab, setTab] = useState<TabId>('accounts')

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
              Accounting
            </h1>
            <p className="text-sm" style={{ color: 'var(--monday-text-muted)' }}>
              General ledger &mdash; double-entry bookkeeping
            </p>
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

        {tab === 'accounts' && <ChartOfAccounts />}
        {tab === 'journal' && <JournalEntries />}
        {tab === 'trial' && <TrialBalanceTab />}
        {tab === 'statements' && <Statements />}
        {tab === 'mappings' && <Mappings />}
      </div>
    </Layout>
  )
}

// --------------------------------------------------------------------------
// Chart of accounts
// --------------------------------------------------------------------------

function ChartOfAccounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', type: 'asset' as AccountType })

  const grouped = useMemo(() => {
    const out: Record<AccountType, Account[]> = {
      asset: [], liability: [], equity: [], revenue: [], expense: [],
    }
    accounts.forEach((a) => out[a.type]?.push(a))
    return out
  }, [accounts])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) return
    createAccount.mutate(form, {
      onSuccess: () => {
        setForm({ code: '', name: '', type: 'asset' })
        setShowForm(false)
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--monday-text-muted)' }}>
          {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancel' : 'New Account'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
              <div className="w-32">
                <label className="text-xs font-medium block mb-1">Code</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="1200"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium block mb-1">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Accounts Receivable"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium block mb-1">Type</label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={createAccount.isPending}>Create</Button>
            </form>
            <p className="text-xs mt-3" style={{ color: 'var(--monday-text-muted)' }}>
              Normal balance is set automatically: assets and expenses are debit-normal,
              liabilities, equity, and revenue are credit-normal.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm">Loading&hellip;</p>}

      {!isLoading && accounts.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--monday-text-muted)' }} />
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--monday-text-muted)' }}>
              Create your chart of accounts to start posting. Auto-posting from invoices,
              fuel, expenses, and payroll stays off until you map each event on the
              Auto-Post tab.
            </p>
          </CardContent>
        </Card>
      )}

      {ACCOUNT_TYPES.map((type) =>
        grouped[type].length > 0 ? (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">{type}</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {grouped[type].map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 font-mono w-24">{a.code}</td>
                      <td className="py-2">{a.name}</td>
                      <td className="py-2 w-20 text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                        {a.normal_balance}
                      </td>
                      <td className="py-2 w-20 text-xs">
                        {!a.is_active && <span className="text-orange-600">inactive</span>}
                      </td>
                      <td className="py-2 w-10 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Delete account ${a.code} ${a.name}?`)) {
                              deleteAccount.mutate(a.id)
                            }
                          }}
                          title="Delete (only allowed with no journal activity)"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Journal entries
// --------------------------------------------------------------------------

function JournalEntries() {
  const { data: entries = [], isLoading } = useJournalEntries()
  const { data: accounts = [] } = useAccounts({ is_active: true })
  const createEntry = useCreateJournalEntry()
  const postEntry = usePostJournalEntry()
  const reverseEntry = useReverseJournalEntry()
  const deleteEntry = useDeleteJournalEntry()

  const [showForm, setShowForm] = useState(false)
  const [entryDate, setEntryDate] = useState(today())
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<{ account_id: string; debit: string; credit: string }[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ])

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
    // Compare in cents to dodge float drift in the balance indicator.
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 }
  }, [lines])

  const balanced = totals.diff === 0 && totals.debit > 0

  const reset = () => {
    setLines([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }])
    setMemo('')
    setEntryDate(today())
    setShowForm(false)
  }

  const submit = (post: boolean) => {
    const payload: JournalLineInput[] = lines
      .filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => ({
        account_id: parseInt(l.account_id, 10),
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }))
    if (payload.length < 2) return
    createEntry.mutate(
      { data: { entry_date: entryDate, memo: memo || undefined, lines: payload }, post },
      { onSuccess: reset }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--monday-text-muted)' }}>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </p>
        <Button onClick={() => setShowForm((s) => !s)} disabled={accounts.length < 2}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancel' : 'New Entry'}
        </Button>
      </div>

      {accounts.length < 2 && (
        <p className="text-sm text-orange-600">
          You need at least two active accounts before you can post an entry.
        </p>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-3">
              <div className="w-44">
                <label className="text-xs font-medium block mb-1">Date</label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Memo</label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                  <th className="text-left pb-1">Account</th>
                  <th className="text-right pb-1 w-36">Debit</th>
                  <th className="text-right pb-1 w-36">Credit</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <select
                        className="w-full h-9 rounded-md border px-2 text-sm"
                        value={line.account_id}
                        onChange={(e) => {
                          const next = [...lines]
                          next[i] = { ...next[i], account_id: e.target.value }
                          setLines(next)
                        }}
                      >
                        <option value="">Select account&hellip;</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} &mdash; {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        className="text-right"
                        value={line.debit}
                        onChange={(e) => {
                          const next = [...lines]
                          // A line is a debit or a credit, never both.
                          next[i] = { ...next[i], debit: e.target.value, credit: '' }
                          setLines(next)
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        className="text-right"
                        value={line.credit}
                        onChange={(e) => {
                          const next = [...lines]
                          next[i] = { ...next[i], credit: e.target.value, debit: '' }
                          setLines(next)
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1 text-right">
                      {lines.length > 2 && (
                        <button onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="pt-2">Totals</td>
                  <td className="pt-2 text-right">{formatCurrency(totals.debit)}</td>
                  <td className="pt-2 text-right">{formatCurrency(totals.credit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <div className="flex items-center justify-between">
              <button
                className="text-sm underline"
                onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '' }])}
              >
                + Add line
              </button>

              <div className="flex items-center gap-3">
                {totals.diff !== 0 ? (
                  <span className="text-sm text-red-600">
                    Out of balance by {formatCurrency(Math.abs(totals.diff))}
                  </span>
                ) : totals.debit > 0 ? (
                  <span className="text-sm text-green-600">Balanced</span>
                ) : null}
                <Button variant="outline" onClick={() => submit(false)} disabled={createEntry.isPending}>
                  Save Draft
                </Button>
                <Button onClick={() => submit(true)} disabled={!balanced || createEntry.isPending}>
                  Post
                </Button>
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
              Posting is permanent. A posted entry cannot be edited or deleted &mdash;
              correct it by posting a reversal.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm">Loading&hellip;</p>}

      {!isLoading && entries.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-sm"
          style={{ color: 'var(--monday-text-muted)' }}>
          No journal entries yet.
        </CardContent></Card>
      )}

      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="pt-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-mono text-sm">
                  {entry.entry_number || `draft #${entry.id}`}
                </span>
                <span className="ml-3 text-sm">{entry.entry_date}</span>
                <span
                  className="ml-3 text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: entry.status === 'posted' ? '#dcfce7' : '#fef9c3',
                    color: entry.status === 'posted' ? '#166534' : '#854d0e',
                  }}
                >
                  {entry.status}
                </span>
                {entry.source !== 'manual' && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-brand/10 text-brand">
                    auto: {entry.source} #{entry.source_id}
                  </span>
                )}
                {entry.reverses_id && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    reversal
                  </span>
                )}
                {entry.memo && (
                  <div className="text-sm mt-1" style={{ color: 'var(--monday-text-muted)' }}>
                    {entry.memo}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {entry.status === 'draft' && (
                  <>
                    <Button size="sm" onClick={() => postEntry.mutate(entry.id)}>
                      <Check className="h-3 w-3 mr-1" /> Post
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Delete this draft?')) deleteEntry.mutate(entry.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {entry.status === 'posted' && !entry.reverses_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm('Post a reversing entry to cancel this one?')) {
                        reverseEntry.mutate({ id: entry.id })
                      }
                    }}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Reverse
                  </Button>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1 font-mono w-24">{line.account_code}</td>
                    <td className="py-1">{line.account_name}</td>
                    <td className="py-1 text-right w-32">
                      {num(line.debit) > 0 ? formatCurrency(num(line.debit)) : ''}
                    </td>
                    <td className="py-1 text-right w-32">
                      {num(line.credit) > 0 ? formatCurrency(num(line.credit)) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------------
// Trial balance
// --------------------------------------------------------------------------

function TrialBalanceTab() {
  const [asOf, setAsOf] = useState(today())
  const { data, isLoading } = useTrialBalance(asOf)

  return (
    <div className="space-y-4">
      <div className="w-48">
        <label className="text-xs font-medium block mb-1">As of</label>
        <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </div>

      {isLoading && <p className="text-sm">Loading&hellip;</p>}

      {data && (
        <Card>
          <CardContent className="pt-6">
            {data.rows.length === 0 ? (
              <p className="text-sm text-center" style={{ color: 'var(--monday-text-muted)' }}>
                Nothing posted as of this date.
              </p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs border-b" style={{ color: 'var(--monday-text-muted)' }}>
                      <th className="text-left pb-2 w-24">Code</th>
                      <th className="text-left pb-2">Account</th>
                      <th className="text-right pb-2 w-36">Debit</th>
                      <th className="text-right pb-2 w-36">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.account_id} className="border-b last:border-0">
                        <td className="py-2 font-mono">{row.code}</td>
                        <td className="py-2">{row.name}</td>
                        <td className="py-2 text-right">
                          {num(row.debit) !== 0 ? formatCurrency(num(row.debit)) : ''}
                        </td>
                        <td className="py-2 text-right">
                          {num(row.credit) !== 0 ? formatCurrency(num(row.credit)) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t-2">
                      <td className="pt-2" colSpan={2}>Total</td>
                      <td className="pt-2 text-right">{formatCurrency(num(data.total_debit))}</td>
                      <td className="pt-2 text-right">{formatCurrency(num(data.total_credit))}</td>
                    </tr>
                  </tfoot>
                </table>
                {!data.is_balanced && (
                  <p className="text-sm text-red-600 mt-3">
                    Trial balance does not foot. Something wrote unbalanced lines directly
                    to the database, bypassing the posting service.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Statements
// --------------------------------------------------------------------------

function Statements() {
  const [start, setStart] = useState(`${new Date().getFullYear()}-01-01`)
  const [end, setEnd] = useState(today())
  const income = useIncomeStatement(start, end)
  const sheet = useBalanceSheet(end)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-44">
          <label className="text-xs font-medium block mb-1">From</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="w-44">
          <label className="text-xs font-medium block mb-1">To</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Income Statement</CardTitle></CardHeader>
          <CardContent>
            {income.data ? (
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="pt-1 pb-1 font-semibold" colSpan={2}>Revenue</td></tr>
                  {income.data.revenue.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-1 pl-4">{l.code} {l.name}</td>
                      <td className="py-1 text-right">{formatCurrency(num(l.amount))}</td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="py-1 pl-4 font-medium">Total revenue</td>
                    <td className="py-1 text-right font-medium">
                      {formatCurrency(num(income.data.total_revenue))}
                    </td>
                  </tr>
                  <tr><td className="pt-3 pb-1 font-semibold" colSpan={2}>Expenses</td></tr>
                  {income.data.expenses.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-1 pl-4">{l.code} {l.name}</td>
                      <td className="py-1 text-right">{formatCurrency(num(l.amount))}</td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="py-1 pl-4 font-medium">Total expenses</td>
                    <td className="py-1 text-right font-medium">
                      {formatCurrency(num(income.data.total_expenses))}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="pt-2">Net income</td>
                    <td className="pt-2 text-right">
                      {formatCurrency(num(income.data.net_income))}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm">Loading&hellip;</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Balance Sheet</CardTitle></CardHeader>
          <CardContent>
            {sheet.data ? (
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="pt-1 pb-1 font-semibold" colSpan={2}>Assets</td></tr>
                  {sheet.data.assets.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-1 pl-4">{l.code} {l.name}</td>
                      <td className="py-1 text-right">{formatCurrency(num(l.amount))}</td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="py-1 pl-4 font-medium">Total assets</td>
                    <td className="py-1 text-right font-medium">
                      {formatCurrency(num(sheet.data.total_assets))}
                    </td>
                  </tr>

                  <tr><td className="pt-3 pb-1 font-semibold" colSpan={2}>Liabilities</td></tr>
                  {sheet.data.liabilities.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-1 pl-4">{l.code} {l.name}</td>
                      <td className="py-1 text-right">{formatCurrency(num(l.amount))}</td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="py-1 pl-4 font-medium">Total liabilities</td>
                    <td className="py-1 text-right font-medium">
                      {formatCurrency(num(sheet.data.total_liabilities))}
                    </td>
                  </tr>

                  <tr><td className="pt-3 pb-1 font-semibold" colSpan={2}>Equity</td></tr>
                  {sheet.data.equity.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-1 pl-4">{l.code} {l.name}</td>
                      <td className="py-1 text-right">{formatCurrency(num(l.amount))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1 pl-4">Retained earnings</td>
                    <td className="py-1 text-right">
                      {formatCurrency(num(sheet.data.retained_earnings))}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 pl-4 font-medium">Total equity</td>
                    <td className="py-1 text-right font-medium">
                      {formatCurrency(num(sheet.data.total_equity))}
                    </td>
                  </tr>

                  <tr className="font-semibold">
                    <td className="pt-2">Liabilities + equity</td>
                    <td className="pt-2 text-right">
                      {formatCurrency(
                        num(sheet.data.total_liabilities) + num(sheet.data.total_equity)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm">Loading&hellip;</p>
            )}
            {sheet.data && !sheet.data.is_balanced && (
              <p className="text-sm text-red-600 mt-3">
                Assets do not equal liabilities plus equity.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Auto-post mappings
// --------------------------------------------------------------------------

function Mappings() {
  const { data: mappings = [] } = useAccountingMappings()
  const { data: accounts = [] } = useAccounts({ is_active: true })
  const upsert = useUpsertMapping()

  const byEvent = useMemo(() => {
    const out: Record<string, { debit?: number; credit?: number }> = {}
    mappings.forEach((m) => {
      out[m.event_key] = { debit: m.debit_account_id, credit: m.credit_account_id }
    })
    return out
  }, [mappings])

  const [draft, setDraft] = useState<Record<string, { debit: string; credit: string }>>({})

  const valueFor = (event: MappingEvent, side: 'debit' | 'credit') => {
    if (draft[event]?.[side] !== undefined) return draft[event][side]
    const existing = byEvent[event]
    return existing ? String(side === 'debit' ? existing.debit : existing.credit) : ''
  }

  const setDraftValue = (event: MappingEvent, side: 'debit' | 'credit', value: string) => {
    setDraft((d) => ({
      ...d,
      [event]: {
        debit: side === 'debit' ? value : valueFor(event, 'debit'),
        credit: side === 'credit' ? value : valueFor(event, 'credit'),
      },
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm mb-1">
            Point each operational event at the two accounts it should post against.
          </p>
          <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
            An event with no mapping is skipped &mdash; the invoice, fuel receipt, expense,
            or settlement still saves normally, it just doesn&apos;t reach the ledger.
            Changing a mapping only affects future postings; entries already on the books
            are untouched.
          </p>
        </CardContent>
      </Card>

      {accounts.length < 2 && (
        <p className="text-sm text-orange-600">
          Create accounts first &mdash; there is nothing to map to yet.
        </p>
      )}

      {EVENTS.map((event) => {
        const configured = !!byEvent[event.key]
        const debitValue = valueFor(event.key, 'debit')
        const creditValue = valueFor(event.key, 'credit')
        const dirty = !!draft[event.key]
        const valid = debitValue && creditValue && debitValue !== creditValue

        return (
          <Card key={event.key}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium">{event.label}</span>
                  <span className="ml-3 text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                    debit {event.debit} &middot; credit {event.credit}
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: configured ? '#dcfce7' : '#f3f4f6',
                    color: configured ? '#166534' : '#6b7280',
                  }}
                >
                  {configured ? 'active' : 'not mapped'}
                </span>
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1">Debit account</label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={debitValue}
                    onChange={(e) => setDraftValue(event.key, 'debit', e.target.value)}
                  >
                    <option value="">Select&hellip;</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} &mdash; {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1">Credit account</label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={creditValue}
                    onChange={(e) => setDraftValue(event.key, 'credit', e.target.value)}
                  >
                    <option value="">Select&hellip;</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} &mdash; {a.name}</option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={!valid || !dirty || upsert.isPending}
                  onClick={() =>
                    upsert.mutate({
                      event_key: event.key,
                      debit_account_id: parseInt(debitValue, 10),
                      credit_account_id: parseInt(creditValue, 10),
                    })
                  }
                >
                  Save
                </Button>
              </div>
              {debitValue && creditValue && debitValue === creditValue && (
                <p className="text-xs text-red-600 mt-2">
                  Debit and credit accounts must differ.
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
