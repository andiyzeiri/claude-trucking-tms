'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, ExpenseFormData } from '@/hooks/use-expenses'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useLoads } from '@/hooks/use-loads'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Expense } from '@/types'

type EditingCell = { id: number | 'new'; field: keyof EditableExpense } | null

interface EditableExpense extends Expense {
  isNew?: boolean
}

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
  'Other'
]

const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Check',
  'Bank Transfer',
  'Other'
]

export default function ExpensesPage() {
  const { data: expensesData, isLoading } = useExpenses(1, 1000)
  const { data: driversData } = useDrivers(1, 1000)
  const { data: trucksData } = useTrucks(1, 1000)
  const { data: loadsData } = useLoads(1, 1000)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const expenses = expensesData?.items || []
  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []
  const loads = loadsData?.items || []

  const [editableExpenses, setEditableExpenses] = useState<EditableExpense[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [groupBy, setGroupBy] = useState<'none' | 'week' | 'category' | 'driver'>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (expenses.length > 0 && editableExpenses.length === 0) {
      setEditableExpenses(expenses)
    }
  }, [expenses.length, editableExpenses.length])

  const addNewExpense = async () => {
    const newExpense: EditableExpense = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      category: 'Fuel',
      description: '',
      amount: 0,
      vendor: '',
      payment_method: 'Cash',
      receipt_number: '',
      driver_id: undefined,
      truck_id: undefined,
      load_id: undefined,
      company_id: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isNew: true
    }

    const backendData: ExpenseFormData = {
      date: newExpense.date,
      category: newExpense.category,
      description: newExpense.description,
      amount: newExpense.amount,
      vendor: newExpense.vendor,
      payment_method: newExpense.payment_method,
      receipt_number: newExpense.receipt_number,
      driver_id: newExpense.driver_id,
      truck_id: newExpense.truck_id,
      load_id: newExpense.load_id
    }

    const result = await createExpense.mutateAsync(backendData)
    if (result) {
      setEditableExpenses([result, ...editableExpenses])
    }
  }

  const updateField = async (id: number | 'new', field: keyof EditableExpense, value: any) => {
    const updatedExpenses = editableExpenses.map(expense => {
      if ((id === 'new' && expense.isNew) || expense.id === id) {
        const updated = { ...expense, [field]: value }

        if (field === 'driver_id') {
          updated.driver = value ? drivers.find(d => d.id === value) : undefined
        } else if (field === 'truck_id') {
          updated.truck = value ? trucks.find(t => t.id === value) : undefined
        }

        return updated
      }
      return expense
    })
    setEditableExpenses(updatedExpenses)

    const expense = updatedExpenses.find(e => (id === 'new' && e.isNew) || e.id === id)
    if (expense && !expense.isNew) {
      const backendData: Partial<ExpenseFormData> = {}
      backendData[field as keyof ExpenseFormData] = value as any
      await updateExpense.mutateAsync({ id: expense.id, data: backendData })
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense.mutateAsync(id)
      setEditableExpenses(editableExpenses.filter(e => e.id !== id))
    }
  }

  function getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((days + startOfYear.getDay() + 1) / 7)
  }

  function getWeekLabel(weekNum: number, year: number): string {
    return `Week ${weekNum}`
  }

  function getWeekDateRange(date: Date): string {
    const dayOfWeek = date.getDay()
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
    const monday = new Date(date)
    monday.setDate(date.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const startMonth = monday.getMonth() + 1
    const startDay = monday.getDate()
    const endMonth = sunday.getMonth() + 1
    const endDay = sunday.getDate()

    return `(${startMonth}/${startDay}-${endMonth}/${endDay})`
  }

  const groupedExpenses = useMemo(() => {
    if (groupBy === 'none') return { 'all': editableExpenses }

    const groups: Record<string, EditableExpense[]> = {}

    editableExpenses.forEach(expense => {
      let groupKey = ''

      if (groupBy === 'week') {
        const date = new Date(expense.date)
        const weekNum = getWeekNumber(date)
        const year = date.getFullYear()
        const weekLabel = getWeekLabel(weekNum, year)
        const weekDateRange = getWeekDateRange(date)
        groupKey = `${weekLabel} ${weekDateRange}`
      } else if (groupBy === 'category') {
        groupKey = expense.category || 'Uncategorized'
      } else if (groupBy === 'driver') {
        groupKey = expense.driver ? `${expense.driver.first_name} ${expense.driver.last_name}` : 'Unassigned'
      }

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(expense)
    })

    return groups
  }, [editableExpenses, groupBy])

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey)
    } else {
      newCollapsed.add(groupKey)
    }
    setCollapsedGroups(newCollapsed)
  }

  const renderGroupHeader = (groupKey: string, expenses: EditableExpense[]) => {
    const isCollapsed = collapsedGroups.has(groupKey)
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    return (
      <tr className="bg-gray-100 border-t-2 border-gray-300">
        <td colSpan={9} className="px-2 py-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleGroup(groupKey)}
              className="flex items-center gap-2 font-semibold text-gray-900"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {groupKey} ({expenses.length})
            </button>
            <div className="text-sm font-semibold text-gray-900">
              Total: ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </td>
      </tr>
    )
  }

  const renderExpenseRow = (expense: EditableExpense) => {
    return (
      <tr
        key={expense.id}
        className="border-b hover:bg-gray-50"
        onContextMenu={(e) => {
          e.preventDefault()
          if (!expense.isNew) {
            handleDelete(expense.id)
          }
        }}
      >
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'date' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'date' ? (
              <input
                type="date"
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.date}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'date', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              />
            ) : (
              <span className="text-sm">
                {new Date(expense.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'category' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'category' ? (
              <select
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.category}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'category', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{expense.category}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'description' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'description' ? (
              <input
                type="text"
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.description || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'description', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              />
            ) : (
              <span className="text-sm">{expense.description || '-'}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'amount' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'amount' ? (
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.amount}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'amount', parseFloat(e.target.value) || 0)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              />
            ) : (
              <span className="text-sm">${Number(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'vendor' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'vendor' ? (
              <input
                type="text"
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.vendor || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'vendor', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              />
            ) : (
              <span className="text-sm">{expense.vendor || '-'}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'payment_method' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'payment_method' ? (
              <select
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.payment_method || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'payment_method', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              >
                <option value="">-</option>
                {PAYMENT_METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{expense.payment_method || '-'}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'receipt_number' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'receipt_number' ? (
              <input
                type="text"
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.receipt_number || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'receipt_number', e.target.value)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              />
            ) : (
              <span className="text-sm">{expense.receipt_number || '-'}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'driver_id' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'driver_id' ? (
              <select
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.driver_id || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'driver_id', e.target.value ? parseInt(e.target.value) : undefined)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              >
                <option value="">-</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">
                {expense.driver ? `${expense.driver.first_name} ${expense.driver.last_name}` : '-'}
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2">
          <div
            className="cursor-pointer px-1 py-1 hover:bg-white hover:shadow-sm rounded"
            onClick={() => setEditingCell({ id: expense.isNew ? 'new' : expense.id, field: 'truck_id' })}
          >
            {editingCell?.id === (expense.isNew ? 'new' : expense.id) && editingCell.field === 'truck_id' ? (
              <select
                className="w-full border rounded px-1 py-1 text-sm"
                value={expense.truck_id || ''}
                onChange={(e) => updateField(expense.isNew ? 'new' : expense.id, 'truck_id', e.target.value ? parseInt(e.target.value) : undefined)}
                onBlur={() => setEditingCell(null)}
                autoFocus
              >
                <option value="">-</option>
                {trucks.map(truck => (
                  <option key={truck.id} value={truck.id}>
                    {truck.truck_number}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">
                {expense.truck ? expense.truck.truck_number : '-'}
              </span>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6">
          <div>Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Group By:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value as any)
                  setCollapsedGroups(new Set())
                }}
              >
                <option value="none">None</option>
                <option value="week">Week</option>
                <option value="category">Category</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <Button onClick={addNewExpense}>
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Truck</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBy === 'none' ? (
                    editableExpenses.map(renderExpenseRow)
                  ) : (
                    Object.entries(groupedExpenses).map(([groupKey, groupExpenses]) => (
                      <React.Fragment key={groupKey}>
                        {renderGroupHeader(groupKey, groupExpenses)}
                        {!collapsedGroups.has(groupKey) && groupExpenses.map(renderExpenseRow)}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
