'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, Package, Users, BarChart3, Plus, Edit, Trash2 } from 'lucide-react'

interface RevenueItem {
  id?: number
  month: string
  amount: number
  description: string
}

interface ExpenseItem {
  id?: number
  month: string
  amount: number
  description: string
  category: string
}

export default function ReportsPage() {
  // Revenue data
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([
    { id: 1, month: "January", amount: 45750.25, description: "Freight Revenue" },
    { id: 2, month: "February", amount: 52100.75, description: "Freight Revenue" },
    { id: 3, month: "March", amount: 48900.50, description: "Freight Revenue" },
    { id: 4, month: "April", amount: 56300.00, description: "Freight Revenue" },
    { id: 5, month: "May", amount: 61200.75, description: "Freight Revenue" }
  ])

  // Expense data
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([
    { id: 1, month: "January", amount: 32400.50, description: "Fuel Costs", category: "Fuel" },
    { id: 2, month: "February", amount: 35200.25, description: "Fuel Costs", category: "Fuel" },
    { id: 3, month: "March", amount: 33750.75, description: "Fuel Costs", category: "Fuel" },
    { id: 4, month: "April", amount: 38100.25, description: "Fuel Costs", category: "Fuel" },
    { id: 5, month: "May", amount: 41500.50, description: "Fuel Costs", category: "Fuel" }
  ])

  // Context menu states
  const [revenueContextMenu, setRevenueContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: RevenueItem | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  const [expenseContextMenu, setExpenseContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: ExpenseItem | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // CRUD operations for Revenue
  const handleCreateRevenue = () => {
    console.log('Create revenue item')
  }

  const handleEditRevenue = (item: RevenueItem) => {
    console.log('Edit revenue:', item)
  }

  const handleDeleteRevenue = (itemId: number) => {
    if (confirm('Are you sure you want to delete this revenue item?')) {
      setRevenueItems(revenueItems.filter(item => item.id !== itemId))
    }
  }

  // CRUD operations for Expenses
  const handleCreateExpense = () => {
    console.log('Create expense item')
  }

  const handleEditExpense = (item: ExpenseItem) => {
    console.log('Edit expense:', item)
  }

  const handleDeleteExpense = (itemId: number) => {
    if (confirm('Are you sure you want to delete this expense item?')) {
      setExpenseItems(expenseItems.filter(item => item.id !== itemId))
    }
  }

  // Context menu handlers for Revenue
  const handleRevenueRightClick = (row: RevenueItem, event: React.MouseEvent) => {
    event.preventDefault()
    setRevenueContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row
    })
  }

  const closeRevenueContextMenu = () => {
    setRevenueContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  }

  // Context menu handlers for Expenses
  const handleExpenseRightClick = (row: ExpenseItem, event: React.MouseEvent) => {
    event.preventDefault()
    setExpenseContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row
    })
  }

  const closeExpenseContextMenu = () => {
    setExpenseContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  }

  return (
    <Layout>
      <div className="page-reports space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-600">Analytics and performance insights</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(45000)}</p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Loads Completed</p>
                  <p className="text-2xl font-bold text-gray-900">127</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Drivers</p>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Growth Rate</p>
                  <p className="text-2xl font-bold text-green-600">+12%</p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue and Expenses Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5 text-green-600" />
                  Revenue
                </CardTitle>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleCreateRevenue}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Revenue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {revenueItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onContextMenu={(e) => handleRevenueRightClick(item, e)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.month}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-700">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(revenueItems.reduce((sum, item) => sum + item.amount, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{revenueItems.length} items</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-red-600" />
                  Expenses
                </CardTitle>
                <Button className="bg-red-600 hover:bg-red-700" onClick={handleCreateExpense}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenseItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onContextMenu={(e) => handleExpenseRightClick(item, e)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.month}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.category}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-700">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(expenseItems.reduce((sum, item) => sum + item.amount, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{expenseItems.length} items</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Context Menus */}
        <ContextMenu
          x={revenueContextMenu.x}
          y={revenueContextMenu.y}
          isVisible={revenueContextMenu.isVisible}
          onClose={closeRevenueContextMenu}
        >
          <ContextMenuItem
            onClick={() => {
              if (revenueContextMenu.row) handleEditRevenue(revenueContextMenu.row)
              closeRevenueContextMenu()
            }}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit Revenue
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              if (revenueContextMenu.row) handleDeleteRevenue(revenueContextMenu.row.id!)
              closeRevenueContextMenu()
            }}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Revenue
          </ContextMenuItem>
        </ContextMenu>

        <ContextMenu
          x={expenseContextMenu.x}
          y={expenseContextMenu.y}
          isVisible={expenseContextMenu.isVisible}
          onClose={closeExpenseContextMenu}
        >
          <ContextMenuItem
            onClick={() => {
              if (expenseContextMenu.row) handleEditExpense(expenseContextMenu.row)
              closeExpenseContextMenu()
            }}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit Expense
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              if (expenseContextMenu.row) handleDeleteExpense(expenseContextMenu.row.id!)
              closeExpenseContextMenu()
            }}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Expense
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}