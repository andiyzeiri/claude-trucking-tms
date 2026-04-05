'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, ExpenseFormData } from '@/hooks/use-expenses'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Plus, Trash2, Building2, Users, Truck, Shield, MoreHorizontal } from 'lucide-react'
import { Expense } from '@/types'
import { formatCurrency } from '@/lib/utils'

type EditingCell = { id: number; field: string } | null
type ExpenseTab = 'company' | 'driver' | 'owner' | 'insurance' | 'misc'

const EXPENSE_CATEGORIES = [
  'Employee', 'Fuel', 'Maintenance', 'Repairs', 'Insurance', 'Registration',
  'Tolls', 'Parking', 'Food', 'Lodging', 'Office', 'Supplies', 'Truck Payment',
  'Trailer Payment', 'ELD', 'Software', 'Phone', 'Rent', 'Utilities',
  'Payroll Tax', 'Workers Comp', 'Accounting', 'Legal', 'Marketing',
  'Dispatch', 'Factoring', 'Drug Test', 'Permits', 'Escrow', 'Other'
]

const TAB_CONFIG: { key: ExpenseTab; label: string; icon: any; activeColor: string }[] = [
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

  const expenses = expensesData?.items || []
  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []

  const [activeTab, setActiveTab] = useState<ExpenseTab>('company')
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

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
          value={rawValue || ''}
          onChange={(e) => {
            const val = type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
            updateField(expense.id, field, val)
          }}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null) }}
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
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Description</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Amount</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Vendor</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Weekly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Monthly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Yearly</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Category</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--monday-border-light)', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
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
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {isEditing(expense.id, '_weekly') ? (
                          <input
                            type="number" step="0.01"
                            className="w-full border rounded px-2 py-1 text-sm text-right"
                            style={{ borderColor: 'var(--monday-border)' }}
                            defaultValue={weekly > 0 ? weekly.toFixed(2) : ''}
                            onBlur={(e) => {
                              const w = parseFloat(e.target.value) || 0
                              const newAmount = costType === 'fixed' ? w * 4.33 : w
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
                              const newAmount = costType === 'fixed' ? m : m / 4.33
                              updateField(expense.id, 'amount', parseFloat(newAmount.toFixed(2)))
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
                              const newAmount = costType === 'fixed' ? y / 12 : y / 52
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
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {renderEditableCell(expense, 'category', {
                          type: 'select',
                          selectOptions: EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
                        })}
                      </td>
                      <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
                        <button onClick={() => handleDelete(expense.id)} className="p-1 rounded hover:bg-red-50" style={{ color: 'var(--monday-stuck)' }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
              {data.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }} colSpan={2}>Total</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalAmount)}</td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalWeekly)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalMonthly)}</td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>{formatCurrency(totalYearly)}</td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }} colSpan={2}></td>
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

        {renderTable('Fixed Costs', fixedExpenses, 'fixed')}
        {renderTable('Variable Costs', variableExpenses, 'variable')}
      </div>
    </Layout>
  )
}
