'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, ExpenseFormData } from '@/hooks/use-expenses'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Plus, Trash2 } from 'lucide-react'
import { Expense } from '@/types'
import { formatCurrency } from '@/lib/utils'

type EditingCell = { id: number; field: string } | null

const EXPENSE_CATEGORIES = [
  'Fuel',
  'Maintenance',
  'Repairs',
  'Insurance',
  'Registration',
  'Tolls',
  'Parking',
  'Food',
  'Lodging',
  'Office',
  'Supplies',
  'Truck Payment',
  'Trailer Payment',
  'ELD',
  'Software',
  'Phone',
  'Other'
]

export default function ExpensesPage() {
  const { data: expensesData, isLoading } = useExpenses(1, 1000)
  const { data: driversData } = useDrivers(1, 1000)
  const { data: trucksData } = useTrucks(1, 1000)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const expenses = expensesData?.items || []
  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []

  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  const fixedExpenses = useMemo(() =>
    expenses.filter(e => e.cost_type === 'fixed').sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  )

  const variableExpenses = useMemo(() =>
    expenses.filter(e => e.cost_type !== 'fixed').sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  )

  const addNewExpense = async (costType: 'fixed' | 'variable') => {
    const data: ExpenseFormData = {
      date: new Date().toISOString().split('T')[0],
      category: costType === 'fixed' ? 'Insurance' : 'Fuel',
      cost_type: costType,
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
              // Parse as int for ID fields
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
          value={type === 'number' ? (rawValue || '') : (rawValue || '')}
          onChange={(e) => {
            const val = type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
            updateField(expense.id, field, val)
          }}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingCell(null)
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
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Description</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Amount</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Vendor</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Weekly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Monthly</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Yearly</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Driver</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Truck</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Category</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--monday-border-light)', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--monday-text-muted)' }}>
                    No {costType} expenses yet
                  </td>
                </tr>
              ) : (
                data.map(expense => {
                  const amount = Number(expense.amount || 0)
                  // Fixed: amount is monthly, calculate weekly/yearly from that
                  // Variable: amount is per-occurrence, calculate weekly=amount, monthly=amount*4.33, yearly=amount*52
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
                          type: 'number',
                          step: '0.01',
                          align: 'right',
                          format: (val) => val ? formatCurrency(Number(val)) : '-'
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                        {renderEditableCell(expense, 'vendor')}
                      </td>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                        <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
                          {amount > 0 ? formatCurrency(weekly) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                        <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
                          {amount > 0 ? formatCurrency(monthly) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
                        <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
                          {amount > 0 ? formatCurrency(yearly) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '120px' }}>
                        {renderEditableCell(expense, 'driver_id', {
                          type: 'select',
                          selectOptions: drivers.map(d => ({ value: String(d.id), label: `${d.first_name} ${d.last_name}` })),
                          format: (val) => {
                            if (!val) return '-'
                            const driver = drivers.find(d => d.id === val)
                            return driver ? `${driver.first_name} ${driver.last_name}` : '-'
                          }
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '90px' }}>
                        {renderEditableCell(expense, 'truck_id', {
                          type: 'select',
                          selectOptions: trucks.filter(t => t.type === 'truck').map(t => ({ value: String(t.id), label: t.truck_number })),
                          format: (val) => {
                            if (!val) return '-'
                            const truck = trucks.find(t => t.id === val)
                            return truck ? truck.truck_number : '-'
                          }
                        })}
                      </td>
                      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', minWidth: '100px' }}>
                        {renderEditableCell(expense, 'category', {
                          type: 'select',
                          selectOptions: EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
                        })}
                      </td>
                      <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1 rounded hover:bg-red-50"
                          style={{ color: 'var(--monday-stuck)' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
              {/* Totals row */}
              {data.length > 0 && (
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }} colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {formatCurrency(totalAmount)}
                  </td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {formatCurrency(totalWeekly)}
                  </td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {formatCurrency(totalMonthly)}
                  </td>
                  <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                    {formatCurrency(totalYearly)}
                  </td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }} colSpan={4}></td>
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
      <div className="p-4 space-y-8 page-expenses">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Expenses</h1>
        {renderTable('Fixed Costs', fixedExpenses, 'fixed')}
        {renderTable('Variable Costs', variableExpenses, 'variable')}
      </div>
    </Layout>
  )
}
