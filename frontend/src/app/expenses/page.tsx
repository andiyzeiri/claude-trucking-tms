'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, ExpenseFormData } from '@/hooks/use-expenses'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks, useUpdateTruck } from '@/hooks/use-trucks'
import { Plus, Building2, Users, Truck, Shield, MoreHorizontal, BarChart3, Calculator, Trash2 } from 'lucide-react'
import { Expense } from '@/types'
import { formatCurrency } from '@/lib/utils'

type EditingCell = { id: number; field: string } | null
type ExpenseTab = 'overview' | 'rate-to-operate' | 'company' | 'driver' | 'owner' | 'insurance' | 'misc'

type RateToOperateRow = { id: number; expense: string; miles: number; ratePerMile: number; total: number }

const EXPENSE_CATEGORIES = [
  'Employee', 'Fuel', 'Maintenance', 'Repairs', 'Insurance', 'Registration',
  'Tolls', 'Parking', 'Food', 'Lodging', 'Office', 'Supplies', 'Truck Payment',
  'Trailer Payment', 'ELD', 'Software', 'Phone', 'Rent', 'Utilities',
  'Payroll Tax', 'Workers Comp', 'Accounting', 'Legal', 'Marketing',
  'Dispatch', 'Factoring', 'Drug Test', 'Permits', 'Escrow', 'Other'
]

const TAB_CONFIG: { key: ExpenseTab; label: string; icon: any; activeColor: string }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3, activeColor: '#0EA5E9' },
  { key: 'rate-to-operate', label: 'Rate To Operate', icon: Calculator, activeColor: '#F59E0B' },
  { key: 'company', label: 'Company', icon: Building2, activeColor: '#3B82F6' },
  { key: 'driver', label: 'Driver', icon: Users, activeColor: '#16A34A' },
  { key: 'owner', label: 'Owner Operator', icon: Truck, activeColor: '#EA580C' },
  { key: 'insurance', label: 'Insurance', icon: Shield, activeColor: '#9333EA' },
  { key: 'misc', label: 'Misc', icon: MoreHorizontal, activeColor: '#6B7280' },
]

export default function ExpensesPage() {
  const { data: expensesData, isLoading } = useExpenses(1, 10000)
  const { data: driversData } = useDrivers(1, 1000)
  const { data: trucksData } = useTrucks(1, 1000)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const updateTruck = useUpdateTruck()

  const expenses = expensesData?.items || []
  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []
  const activeTrucks = trucks.filter((t: any) => t.type === 'truck')

  const [activeTab, setActiveTab] = useState<ExpenseTab>('overview')
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const initRows = (key: string, defaults: RateToOperateRow[]) => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      if (saved) return JSON.parse(saved)
    }
    return defaults
  }
  const initNextId = (key: string, fallback: number) => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      if (saved) {
        const rows = JSON.parse(saved) as RateToOperateRow[]
        return Math.max(...rows.map(r => r.id), 0) + 1
      }
    }
    return fallback
  }

  const [rtoRows, setRtoRows] = useState<RateToOperateRow[]>(() => initRows('rto-variable', [
    { id: 1, expense: 'Fuel', miles: 0, ratePerMile: 0, total: 0 },
    { id: 2, expense: 'Maintenance', miles: 0, ratePerMile: 0, total: 0 },
    { id: 3, expense: 'Tires', miles: 0, ratePerMile: 0, total: 0 },
    { id: 4, expense: 'Tolls', miles: 0, ratePerMile: 0, total: 0 },
    { id: 5, expense: 'DEF', miles: 0, ratePerMile: 0, total: 0 },
  ]))
  const [rtoNextId, setRtoNextId] = useState(() => initNextId('rto-variable', 6))

  const [rtoFixedRows, setRtoFixedRows] = useState<RateToOperateRow[]>(() => initRows('rto-fixed', [
    { id: 1, expense: 'Insurance', miles: 0, ratePerMile: 0, total: 0 },
    { id: 2, expense: 'Truck Payment', miles: 0, ratePerMile: 0, total: 0 },
    { id: 3, expense: 'Trailer Payment', miles: 0, ratePerMile: 0, total: 0 },
    { id: 4, expense: 'Permits', miles: 0, ratePerMile: 0, total: 0 },
    { id: 5, expense: 'ELD', miles: 0, ratePerMile: 0, total: 0 },
  ]))
  const [rtoFixedNextId, setRtoFixedNextId] = useState(() => initNextId('rto-fixed', 6))

  const [rtoSummaryMiles, setRtoSummaryMiles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rto-summary-miles')
      if (saved) return parseFloat(saved) || 0
    }
    return 0
  })

  const saveRows = (key: string, rows: RateToOperateRow[], setter: (r: RateToOperateRow[]) => void) => {
    setter(rows)
    localStorage.setItem(key, JSON.stringify(rows))
  }

  const tabExpenses = useMemo(() =>
    expenses.filter(e => (e.expense_group || 'company') === activeTab),
    [expenses, activeTab]
  )

  const fixedExpenses = useMemo(() =>
    tabExpenses.filter(e => e.cost_type === 'fixed').sort((a, b) => b.date.localeCompare(a.date)),
    [tabExpenses]
  )

  const variableExpenses = useMemo(() =>
    tabExpenses.filter(e => e.cost_type !== 'fixed').sort((a, b) => b.date.localeCompare(a.date)),
    [tabExpenses]
  )

  const addNewExpense = async (costType: 'fixed' | 'variable') => {
    const data: ExpenseFormData = {
      date: new Date().toISOString().split('T')[0],
      category: costType === 'fixed' ? 'Insurance' : 'Fuel',
      cost_type: costType,
      expense_group: activeTab,
      description: '',
      amount: 0,
    }
    await createExpense.mutateAsync(data)
  }

  const updateField = async (id: number, field: string, value: any) => {
    const data: Partial<ExpenseFormData> = {}
    ;(data as any)[field] = value
    await updateExpense.mutateAsync({ id, data })
    setEditingCell(null)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Delete this expense?')) {
      await deleteExpense.mutateAsync(id)
    }
  }

  const isEditing = (id: number, field: string) =>
    editingCell?.id === id && editingCell?.field === field

  const renderEditableCell = (expense: Expense, field: string, options?: {
    type?: 'text' | 'number' | 'date' | 'select'
    selectOptions?: { value: string; label: string }[]
    format?: (val: any) => string
    align?: 'left' | 'right'
    step?: string
  }) => {
    const { type = 'text', selectOptions, format, align = 'left', step } = options || {}
    const rawValue = (expense as any)[field]

    if (isEditing(expense.id, field)) {
      if (type === 'select') {
        return (
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            style={{ borderColor: 'var(--monday-border)' }}
            value={rawValue || ''}
            onChange={(e) => {
              const val = e.target.value
              if (!val) { updateField(expense.id, field, null); return }
              if (field === 'driver_id' || field === 'truck_id') {
                updateField(expense.id, field, parseInt(val))
              } else {
                updateField(expense.id, field, val)
              }
            }}
            onBlur={() => setEditingCell(null)}
            autoFocus
          >
            <option value="">-</option>
            {selectOptions?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      }
      return (
        <input
          type={type}
          step={step}
          className={`w-full border rounded px-2 py-1 text-sm ${align === 'right' ? 'text-right' : ''}`}
          style={{ borderColor: 'var(--monday-border)' }}
          defaultValue={rawValue || ''}
          onBlur={(e) => {
            const val = type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
            updateField(expense.id, field, val)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditingCell(null)
          }}
          autoFocus
        />
      )
    }

    const displayValue = format ? format(rawValue) : (rawValue || '-')
    return (
      <div
        onClick={() => setEditingCell({ id: expense.id, field })}
        className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-white hover:shadow-sm"
        style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)', textAlign: align }}
      >
        {displayValue}
      </div>
    )
  }

  const renderTable = (title: string, data: Expense[], costType: 'fixed' | 'variable') => {
    const totalAmount = data.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const totalWeekly = data.reduce((sum, e) => {
      const amt = Number(e.amount || 0)
      return sum + (costType === 'fixed' ? amt / 4.33 : amt)
    }, 0)
    const totalMonthly = data.reduce((sum, e) => {
      const amt = Number(e.amount || 0)
      return sum + (costType === 'fixed' ? amt : amt * 4.33)
    }, 0)
    const totalYearly = data.reduce((sum, e) => {
      const amt = Number(e.amount || 0)
      return sum + (costType === 'fixed' ? amt * 12 : amt * 52)
    }, 0)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
            {title}
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--monday-text-muted)' }}>
              ({data.length} {data.length === 1 ? 'expense' : 'expenses'})
            </span>
          </h2>
          <button
            onClick={() => addNewExpense(costType)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--monday-blue)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add {costType === 'fixed' ? 'Fixed' : 'Variable'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Date</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Category</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Description</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Amount</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Vendor</th>
                {costType === 'fixed' && (
                  <>
                    <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Weekly</th>
                    <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Monthly</th>
                    <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Yearly</th>
                    <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>YTD</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={costType === 'fixed' ? 9 : 5} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                    No {costType} expenses yet
                  </td>
                </tr>
              ) : (
                data.map(expense => {
                  const amount = Number(expense.amount || 0)
                  const weekly = costType === 'fixed' ? amount / 4.33 : amount
                  const monthly = costType === 'fixed' ? amount : amount * 4.33
                  const yearly = costType === 'fixed' ? amount * 12 : amount * 52

                  return (
                    <tr
                      key={expense.id}
                      className="border-b transition-colors"
                      style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)' }}
                      onContextMenu={(e) => { e.preventDefault(); handleDelete(expense.id) }}
                    >
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '110px' }}>
                        {renderEditableCell(expense, 'date', {
                          type: 'date',
                          format: (val) => val ? new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '-'
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {renderEditableCell(expense, 'category', {
                          type: 'select',
                          selectOptions: EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '150px' }}>
                        {renderEditableCell(expense, 'description')}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {renderEditableCell(expense, 'amount', {
                          type: 'number', step: '0.01', align: 'right',
                          format: (val) => val ? formatCurrency(Number(val)) : '-'
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                        {renderEditableCell(expense, 'vendor')}
                      </td>
                      {costType === 'fixed' && (
                        <>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {isEditing(expense.id, '_weekly') ? (
                          <input
                            type="number" step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm text-right"
                            style={{ borderColor: 'var(--monday-border)' }}
                            defaultValue={weekly > 0 ? weekly.toFixed(2) : ''}
                            onBlur={(e) => {
                              const w = parseFloat(e.target.value) || 0
                              const newAmount = w * 4.33
                              updateField(expense.id, 'amount', parseFloat(newAmount.toFixed(2)))
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                            autoFocus
                          />
                        ) : (
                          <div onClick={() => setEditingCell({ id: expense.id, field: '_weekly' })} className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-white hover:shadow-sm" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                            {amount > 0 ? formatCurrency(weekly) : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {isEditing(expense.id, '_monthly') ? (
                          <input
                            type="number" step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm text-right"
                            style={{ borderColor: 'var(--monday-border)' }}
                            defaultValue={monthly > 0 ? monthly.toFixed(2) : ''}
                            onBlur={(e) => {
                              const m = parseFloat(e.target.value) || 0
                              updateField(expense.id, 'amount', parseFloat(m.toFixed(2)))
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                            autoFocus
                          />
                        ) : (
                          <div onClick={() => setEditingCell({ id: expense.id, field: '_monthly' })} className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-white hover:shadow-sm" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                            {amount > 0 ? formatCurrency(monthly) : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {isEditing(expense.id, '_yearly') ? (
                          <input
                            type="number" step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm text-right"
                            style={{ borderColor: 'var(--monday-border)' }}
                            defaultValue={yearly > 0 ? yearly.toFixed(2) : ''}
                            onBlur={(e) => {
                              const y = parseFloat(e.target.value) || 0
                              const newAmount = y / 12
                              updateField(expense.id, 'amount', parseFloat(newAmount.toFixed(2)))
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                            autoFocus
                          />
                        ) : (
                          <div onClick={() => setEditingCell({ id: expense.id, field: '_yearly' })} className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-white hover:shadow-sm" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                            {amount > 0 ? formatCurrency(yearly) : '-'}
                          </div>
                        )}
                      </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>
                            {(() => {
                              const now = new Date()
                              const startOfYear = new Date(now.getFullYear(), 0, 1)
                              const weeksElapsed = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
                              return amount > 0 ? formatCurrency(weekly * weeksElapsed) : '-'
                            })()}
                          </div>
                        </td>
                        </>
                      )}
                    </tr>
                  )
                })
              )}
              {data.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }} colSpan={3}>Total</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalAmount)}</td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
                  {costType === 'fixed' && (
                    <>
                      <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalWeekly)}</td>
                      <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalMonthly)}</td>
                      <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalYearly)}</td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                        {(() => {
                          const now = new Date()
                          const startOfYear = new Date(now.getFullYear(), 0, 1)
                          const weeksElapsed = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
                          return formatCurrency(totalWeekly * weeksElapsed)
                        })()}
                      </td>
                    </>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderInsuranceTable = () => {
    const totalCargo = activeTrucks.reduce((s: number, t: any) => s + (Number(t.cargo_insurance) || 0), 0)
    const totalLiability = activeTrucks.reduce((s: number, t: any) => s + (Number(t.liability_insurance) || 0), 0)
    const totalPhysical = activeTrucks.reduce((s: number, t: any) => s + (Number(t.physical_damage_insurance) || 0), 0)
    const grandTotal = totalCargo + totalLiability + totalPhysical

    const updateInsurance = (truckId: number, field: string, value: number) => {
      updateTruck.mutate({ id: truckId, data: { [field]: value } })
    }

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
          Truck Insurance
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--monday-text-muted)' }}>
            ({activeTrucks.length} trucks)
          </span>
        </h2>
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Truck #</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>VIN</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Value</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Cargo</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Liability</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Physical Damage</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Weekly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Monthly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Yearly</th>
                <th className="px-3 py-2.5 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {[...activeTrucks].sort((a: any, b: any) => a.truck_number.localeCompare(b.truck_number, undefined, { numeric: true })).map((truck: any) => {
                const cargo = Number(truck.cargo_insurance) || 0
                const liability = Number(truck.liability_insurance) || 0
                const physical = Number(truck.physical_damage_insurance) || 0
                const total = cargo + liability + physical

                return (
                  <tr
                    key={truck.id}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)' }}
                  >
                    <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                      {truck.truck_number}
                    </td>
                    <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)', fontFamily: 'monospace' }}>
                      {truck.vin || '-'}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {truck.value ? formatCurrency(Number(truck.value)) : '-'}
                    </td>
                    {['cargo_insurance', 'liability_insurance', 'physical_damage_insurance'].map(field => (
                      <td key={field} className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {isEditing(truck.id, field) ? (
                          <input
                            type="number" step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm text-right"
                            style={{ borderColor: 'var(--monday-border)' }}
                            defaultValue={Number((truck as any)[field]) || ''}
                            onBlur={(e) => updateInsurance(truck.id, field, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell({ id: truck.id, field })}
                            className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-white hover:shadow-sm"
                            style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}
                          >
                            {Number((truck as any)[field]) > 0 ? formatCurrency(Number((truck as any)[field])) : '-'}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>
                      {total > 0 ? formatCurrency(total) : '-'}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {total > 0 ? formatCurrency(total / 52) : '-'}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {total > 0 ? formatCurrency(total / 12) : '-'}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {total > 0 ? formatCurrency(total) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>
                      {(() => {
                        if (total <= 0) return '-'
                        const now = new Date()
                        const startOfYear = new Date(now.getFullYear(), 0, 1)
                        const weeksElapsed = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
                        return formatCurrency((total / 52) * weeksElapsed)
                      })()}
                    </td>
                  </tr>
                )
              })}
              {activeTrucks.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }} colSpan={3}>Total</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalCargo)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalLiability)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalPhysical)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal / 52)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal / 12)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal)}</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {(() => {
                      const now = new Date()
                      const startOfYear = new Date(now.getFullYear(), 0, 1)
                      const weeksElapsed = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
                      return formatCurrency((grandTotal / 52) * weeksElapsed)
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const monthlyOverview = useMemo(() => {
    const monthMap: Record<string, { fixed: number; variable: number }> = {}
    expenses.forEach(e => {
      const d = e.date
      if (!d) return
      const key = d.substring(0, 7) // "YYYY-MM"
      if (!monthMap[key]) monthMap[key] = { fixed: 0, variable: 0 }
      const amt = Number(e.amount || 0)
      if (e.cost_type === 'fixed') {
        monthMap[key].fixed += amt
      } else {
        monthMap[key].variable += amt
      }
    })
    return Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, vals]) => ({
        month,
        label: new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        fixed: vals.fixed,
        variable: vals.variable,
        total: vals.fixed + vals.variable,
      }))
  }, [expenses])

  const renderRtoTable = (
    title: string,
    rows: RateToOperateRow[],
    setRows: (r: RateToOperateRow[]) => void,
    storageKey: string,
    nextId: number,
    setNextId: (n: number) => void,
  ) => {
    const addRow = () => {
      const newRow: RateToOperateRow = { id: nextId, expense: '', miles: 0, ratePerMile: 0, total: 0 }
      setNextId(nextId + 1)
      saveRows(storageKey, [...rows, newRow], setRows)
    }

    const updateRow = (id: number, field: 'expense' | 'miles' | 'ratePerMile' | 'total', value: string | number) => {
      saveRows(storageKey, rows.map(r => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === 'miles') {
          const miles = Number(value) || 0
          if (miles > 0 && updated.ratePerMile > 0) {
            updated.total = parseFloat((miles * updated.ratePerMile).toFixed(2))
          } else if (miles > 0 && updated.total > 0) {
            updated.ratePerMile = parseFloat((updated.total / miles).toFixed(4))
          }
        } else if (field === 'ratePerMile') {
          const rpm = Number(value) || 0
          if (updated.miles > 0 && rpm > 0) {
            updated.total = parseFloat((updated.miles * rpm).toFixed(2))
          } else if (rpm > 0 && updated.total > 0) {
            updated.miles = parseFloat((updated.total / rpm).toFixed(2))
          }
        } else if (field === 'total') {
          const tot = Number(value) || 0
          if (updated.miles > 0 && tot > 0) {
            updated.ratePerMile = parseFloat((tot / updated.miles).toFixed(4))
          } else if (updated.ratePerMile > 0 && tot > 0) {
            updated.miles = parseFloat((tot / updated.ratePerMile).toFixed(2))
          }
        }
        return updated
      }), setRows)
    }

    const deleteRow = (id: number) => {
      saveRows(storageKey, rows.filter(r => r.id !== id), setRows)
    }

    const grandRate = rows.reduce((s, r) => s + r.ratePerMile, 0)
    const grandTotal = rows.reduce((s, r) => s + r.total, 0)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
            {title}
          </h2>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white"
            style={{ backgroundColor: '#F59E0B' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Expense</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Miles</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Rate Per Mile</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--monday-border-light)', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                    No rows yet — click Add Row to start
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)' }}
                  >
                    <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '180px' }}>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 outline-none text-sm px-1.5 py-1"
                        style={{ color: 'var(--monday-text-primary)' }}
                        value={row.expense}
                        onChange={(e) => updateRow(row.id, 'expense', e.target.value)}
                        placeholder="Expense name"
                      />
                    </td>
                    <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                      <input
                        type="number"
                        className="w-full bg-transparent border-0 outline-none text-sm text-right px-1.5 py-1"
                        style={{ color: 'var(--monday-text-primary)' }}
                        value={row.miles || ''}
                        onChange={(e) => updateRow(row.id, 'miles', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full bg-transparent border-0 outline-none text-sm text-right px-1.5 py-1"
                        style={{ color: 'var(--monday-text-primary)' }}
                        value={row.ratePerMile || ''}
                        onChange={(e) => updateRow(row.id, 'ratePerMile', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-transparent border-0 outline-none text-sm text-right px-1.5 py-1"
                        style={{ color: 'var(--monday-text-primary)', fontWeight: 600 }}
                        value={row.total || ''}
                        onChange={(e) => updateRow(row.id, 'total', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {rows.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>Total</td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>${grandRate.toFixed(4)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderRtoSummary = () => {
    const variablePerMile = rtoRows.reduce((s, r) => s + r.ratePerMile, 0)
    const fixedTotal = rtoFixedRows.reduce((s, r) => s + r.total, 0)
    const fixedPerMile = rtoSummaryMiles > 0 ? fixedTotal / rtoSummaryMiles : 0
    const totalPerMile = variablePerMile + fixedPerMile

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
          Cost Per Mile Summary
        </h2>
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Miles</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Variable</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Fixed</th>
                <th className="px-3 py-2.5 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: 'var(--monday-bg-primary)' }}>
                <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '140px' }}>
                  <input
                    type="number"
                    className="w-full bg-transparent border-0 outline-none text-sm text-right px-1.5 py-1"
                    style={{ color: 'var(--monday-text-primary)', fontWeight: 600 }}
                    value={rtoSummaryMiles || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setRtoSummaryMiles(val)
                      localStorage.setItem('rto-summary-miles', String(val))
                    }}
                    placeholder="Enter miles"
                  />
                </td>
                <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>
                  ${variablePerMile.toFixed(4)}
                </td>
                <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>
                  {rtoSummaryMiles > 0 ? '$' + fixedPerMile.toFixed(4) : '-'}
                </td>
                <td className="px-3 py-2.5 text-right" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--monday-text-primary)' }}>
                  {rtoSummaryMiles > 0 ? '$' + totalPerMile.toFixed(4) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderRateToOperate = () => (
    <div className="space-y-8">
      {renderRtoTable('Variable Costs', rtoRows, setRtoRows, 'rto-variable', rtoNextId, setRtoNextId)}
      {renderRtoTable('Fixed Costs', rtoFixedRows, setRtoFixedRows, 'rto-fixed', rtoFixedNextId, setRtoFixedNextId)}
      {renderRtoSummary()}
    </div>
  )

  const renderOverviewTable = () => {
    const grandFixed = monthlyOverview.reduce((s, m) => s + m.fixed, 0)
    const grandVariable = monthlyOverview.reduce((s, m) => s + m.variable, 0)
    const grandTotal = grandFixed + grandVariable

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
          Monthly Expense Summary
        </h2>
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Month</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Fixed Expenses</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Variable Expenses</th>
                <th className="px-3 py-2.5 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {monthlyOverview.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                    No expenses yet
                  </td>
                </tr>
              ) : (
                monthlyOverview.map(row => (
                  <tr
                    key={row.month}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)' }}
                  >
                    <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>{row.label}</td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(row.fixed)}</td>
                    <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(row.variable)}</td>
                    <td className="px-3 py-2.5 text-right" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))
              )}
              {monthlyOverview.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>Grand Total</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandFixed)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandVariable)}</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{ fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  return (
    <Layout>
      <div className="p-4 space-y-6 page-expenses">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Expenses</h1>

        {/* Tabs */}
        <div className="flex gap-2">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const tabCount = expenses.filter(e => (e.expense_group || 'company') === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? tab.activeColor : '#F3F4F6',
                  color: isActive ? 'white' : '#6B7280',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tabCount > 0 && (
                  <span className="text-xs rounded-full px-2 py-0.5" style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
                    color: isActive ? 'white' : '#6B7280'
                  }}>{tabCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'overview' ? (
          renderOverviewTable()
        ) : activeTab === 'rate-to-operate' ? (
          renderRateToOperate()
        ) : activeTab === 'insurance' ? (
          renderInsuranceTable()
        ) : (
          <>
            {renderTable('Fixed Costs', fixedExpenses, 'fixed')}
            {renderTable('Variable Costs', variableExpenses, 'variable')}
          </>
        )}
      </div>
    </Layout>
  )
}
