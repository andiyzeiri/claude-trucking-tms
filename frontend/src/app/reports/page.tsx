'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { formatCurrency } from '@/lib/utils'
import { ChevronRight, ChevronDown, TrendingUp, Truck, Calendar, CalendarDays, Gauge, LayoutDashboard } from 'lucide-react'
import MileageReport from '@/components/reports/mileage-report'
import OverviewReport from '@/components/reports/overview-report'
import WeeklyReport from '@/components/reports/weekly-report'
import { useLoads } from '@/hooks/use-loads'
import { useDrivers } from '@/hooks/use-drivers'
import { useExpenses } from '@/hooks/use-expenses'
import { useFuel } from '@/hooks/use-fuel'
import { useDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
import { useCalculatedPayroll } from '@/hooks/use-payroll'

// Helper to safely convert to number, defaulting to 0 for NaN/null/undefined
function safeNumber(value: any): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

// Backend returns datetimes without timezone (e.g., "2024-12-28T14:00:00")
// JavaScript would parse these as local time, so we append 'Z' to force UTC
function normalizeDateTime(dateString: string): string {
  if (!dateString) return dateString
  // If already has timezone info (Z or +/-offset), return as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return dateString
  }
  // Append Z to treat as UTC
  return dateString + 'Z'
}

// Helper to get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  // Use UTC methods to get the date components (we store wall-clock time as UTC)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  return weekNum
}

// Helper to get ISO week year (the year the week belongs to)
function getISOWeekYear(date: Date): number {
  // Use UTC methods to get the date components (we store wall-clock time as UTC)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

interface ExpenseEntry {
  id: number
  date: string
  category: string
  cost_type: string
  description: string
  amount: number
  vendor: string
  driver_id: number | null
  truck_id: number | null
}

type TabType = 'overview' | 'weekly' | 'equipment' | 'expenses' | 'mileage'

export default function ReportsPage() {
  // Fetch ALL data - use large limit to get everything
  const { data: loadsData, isLoading: loadsLoading } = useLoads(1, 10000)
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(1, 10000)
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const { data: driverSettingsData } = useDriverPayrollSettings()

  const loads = loadsData?.items || []
  const drivers = driversData?.items || []
  const expenses = expensesData?.items || []
  const fuel = fuelData || []

  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const { data: calculatedPayroll } = useCalculatedPayroll(selectedYear)
  const [expandedDrivers, setExpandedDrivers] = useState<Set<number>>(new Set())

  // Equipment expenses state (persisted in localStorage)
  const EQUIP_CATEGORIES = ['Insurance', 'Truck', 'Trailer', 'Maintenance', 'ELD', 'Brakes', 'Tires', 'Tolls']
  const [equipCosts, setEquipCosts] = useState<Record<string, number>>({})
  useEffect(() => {
    const saved = localStorage.getItem('equipmentExpenses')
    if (saved) setEquipCosts(JSON.parse(saved))
  }, [])
  const updateEquipCost = (category: string, value: number) => {
    const updated = { ...equipCosts, [category]: value }
    setEquipCosts(updated)
    localStorage.setItem('equipmentExpenses', JSON.stringify(updated))
  }

  const isLoading = loadsLoading || driversLoading || expensesLoading || fuelLoading

  // Get available years from loads data
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    years.add(currentYear) // Always include current year

    loads.forEach(load => {
      if (load.pickup_date) {
        const loadDate = new Date(normalizeDateTime(load.pickup_date))
        if (!isNaN(loadDate.getTime())) {
          const isoYear = getISOWeekYear(loadDate)
          if (!isNaN(isoYear)) {
            years.add(isoYear)
          }
        }
      }
    })

    expenses.forEach(expense => {
      if (expense.date) {
        const expenseDate = new Date(normalizeDateTime(expense.date))
        if (!isNaN(expenseDate.getTime())) {
          const year = expenseDate.getUTCFullYear()
          if (!isNaN(year)) {
            years.add(year)
          }
        }
      }
    })

    fuel.forEach(f => {
      if (f.date) {
        const fuelDate = new Date(normalizeDateTime(f.date))
        if (!isNaN(fuelDate.getTime())) {
          const year = fuelDate.getUTCFullYear()
          if (!isNaN(year)) {
            years.add(year)
          }
        }
      }
    })

    // Filter out any NaN values and sort descending (newest first)
    return Array.from(years).filter(y => !isNaN(y)).sort((a, b) => b - a)
  }, [loads, expenses, fuel])

  // Find the last week number that has fuel on the payroll tab
  const lastFuelWeek = useMemo(() => {
    let maxWeek = 0
    if (calculatedPayroll && Array.isArray(calculatedPayroll)) {
      calculatedPayroll.forEach((entry: any) => {
        if (!entry?.driver_id || !entry?.week_number) return
        if ((Number(entry.fuel) || 0) > 0 && entry.week_number > maxWeek) {
          maxWeek = entry.week_number
        }
      })
    }
    return maxWeek || 52 // fallback to 52 if no fuel data
  }, [calculatedPayroll])

  // Build fuel data per driver (via truck assignment from settings)
  const fuelByDriver = useMemo(() => {
    const settingsMap = new Map<number, any>()
    if (driverSettingsData) driverSettingsData.forEach((s: any) => settingsMap.set(s.driver_id, s))

    // Aggregate fuel by truck for the year
    const fuelByTruck = new Map<number, { totalAmount: number; totalMiles: number }>()
    const fuelEntriesByTruck = new Map<number, Array<{ odometer: number; weekYear: number; weekNum: number }>>()

    fuel.forEach((fe: any) => {
      if (!fe.date || !fe.truck_id) return
      const fDate = new Date(fe.date + 'T00:00:00')
      const d = new Date(Date.UTC(fDate.getFullYear(), fDate.getMonth(), fDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const fYear = d.getUTCFullYear()
      if (fYear !== selectedYear) return
      const fWeekNum = getWeekNumber(fDate)
      if (fWeekNum > lastFuelWeek) return

      const amount = (Number(fe.total_amount) || 0) + (Number(fe.def_price) || 0)
      const existing = fuelByTruck.get(fe.truck_id) || { totalAmount: 0, totalMiles: 0 }
      existing.totalAmount += amount
      fuelByTruck.set(fe.truck_id, existing)

      if (fe.odometer) {
        if (!fuelEntriesByTruck.has(fe.truck_id)) fuelEntriesByTruck.set(fe.truck_id, [])
        fuelEntriesByTruck.get(fe.truck_id)!.push({ odometer: Number(fe.odometer), weekYear: fYear, weekNum: 0 })
      }
    })

    // Calculate miles from odometer (max - min)
    fuelEntriesByTruck.forEach((entries, truckId) => {
      if (entries.length > 1) {
        const odoms = entries.map(e => e.odometer)
        const miles = Math.max(...odoms) - Math.min(...odoms)
        const existing = fuelByTruck.get(truckId)
        if (existing) existing.totalMiles = miles
      }
    })

    // Map to drivers via settings truck assignment
    const result = new Map<number, { fuelTotal: number; fuelMiles: number; pricePerMile: number }>()
    drivers.forEach((driver: any) => {
      const settings = settingsMap.get(driver.id)
      if (settings?.truck_id) {
        const truckData = fuelByTruck.get(settings.truck_id)
        if (truckData) {
          result.set(driver.id, {
            fuelTotal: truckData.totalAmount,
            fuelMiles: truckData.totalMiles,
            pricePerMile: truckData.totalMiles > 0 ? truckData.totalAmount / truckData.totalMiles : 0
          })
        }
      }
    })
    return result
  }, [fuel, drivers, driverSettingsData, selectedYear, lastFuelWeek])

  // Build expense report data grouped by driver type, then by category/week
  const expenseReportData = useMemo(() => {
    // Group expenses by category for the selected year
    const byCategory = new Map<string, { total: number; entries: ExpenseEntry[] }>()
    let totalAmount = 0

    expenses.forEach((exp: any) => {
      if (!exp.date) return
      const expDate = new Date(exp.date + 'T00:00:00')
      const d = new Date(Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const expYear = d.getUTCFullYear()
      if (expYear !== selectedYear) return

      const cat = exp.category || 'Uncategorized'
      const amount = Number(exp.amount) || 0
      if (!byCategory.has(cat)) {
        byCategory.set(cat, { total: 0, entries: [] })
      }
      const catData = byCategory.get(cat)!
      catData.total += amount
      catData.entries.push({
        id: exp.id,
        date: exp.date,
        category: cat,
        cost_type: exp.cost_type || 'variable',
        description: exp.description || '',
        amount,
        vendor: exp.vendor || '',
        driver_id: exp.driver_id,
        truck_id: exp.truck_id
      })
      totalAmount += amount
    })

    // Also add fuel as a category
    let fuelTotal = 0
    const fuelEntries: ExpenseEntry[] = []
    fuel.forEach((fe: any) => {
      if (!fe.date) return
      const fDate = new Date(fe.date + 'T00:00:00')
      const d = new Date(Date.UTC(fDate.getFullYear(), fDate.getMonth(), fDate.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const fYear = d.getUTCFullYear()
      if (fYear !== selectedYear) return

      const amount = (Number(fe.total_amount) || 0) + (Number(fe.def_price) || 0)
      if (amount > 0) {
        fuelTotal += amount
        fuelEntries.push({
          id: fe.id,
          date: fe.date,
          category: 'Fuel',
          cost_type: 'variable',
          description: fe.location || 'Fuel',
          amount,
          vendor: fe.location || '',
          driver_id: fe.driver_id,
          truck_id: fe.truck_id
        })
      }
    })
    if (fuelEntries.length > 0) {
      byCategory.set('Fuel', { total: fuelTotal, entries: fuelEntries })
      totalAmount += fuelTotal
    }

    return {
      categories: Array.from(byCategory.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      totalAmount
    }
  }, [expenses, fuel, selectedYear])

  const toggleDriver = (driverId: number) => {
    const newExpanded = new Set(expandedDrivers)
    if (newExpanded.has(driverId)) {
      newExpanded.delete(driverId)
    } else {
      newExpanded.add(driverId)
    }
    setExpandedDrivers(newExpanded)
  }

  // Format number safely (avoid NaN display)
  const formatNumber = (num: number): string => {
    const safe = safeNumber(num)
    return safe.toLocaleString()
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="page-reports space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">Loading reports...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-reports space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <p className="text-gray-600">Year overview and weekly statistics, built on Payroll</p>
          </div>
        </div>

        {/* Year Tabs */}
        {activeTab !== 'mileage' && (
        <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex gap-1">
          <Calendar className="h-5 w-5 text-gray-500 my-auto mx-2" />
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                selectedYear === year
                  ? 'bg-brand text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {([['overview', 'Overview', LayoutDashboard], ['weekly', 'Weekly', CalendarDays]] as const).map(([key, text, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {text}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('equipment')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'equipment'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Equipment Expenses
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expenses'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Expenses
            </button>
            <button
              onClick={() => setActiveTab('mileage')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mileage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Gauge className="h-4 w-4" />
              Mileage
            </button>
          </nav>
        </div>

        {activeTab === 'overview' && <OverviewReport year={selectedYear} />}
        {activeTab === 'weekly' && <WeeklyReport year={selectedYear} />}
        {activeTab === 'mileage' && <MileageReport />}


        {/* Equipment Expenses tab */}
        {activeTab === 'equipment' && (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Expense</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Cost per 100k Miles</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {EQUIP_CATEGORIES.map((cat) => {
                    const cost = equipCosts[cat] || 0
                    const totalMiles = Array.from(fuelByDriver.values()).reduce((s, d) => s + d.fuelMiles, 0)
                    const costPer100k = totalMiles > 0 ? (cost / totalMiles) * 100000 : 0
                    return (
                      <tr key={cat} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{cat}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <input
                            type="number"
                            step="0.01"
                            className="w-32 text-sm border rounded px-2 py-1 text-right"
                            value={cost || ''}
                            placeholder="0.00"
                            onChange={(e) => updateEquipCost(cat, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 font-semibold">
                          {costPer100k > 0 ? formatCurrency(costPer100k) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals Row */}
                  {(() => {
                    const totalCost = EQUIP_CATEGORIES.reduce((s, cat) => s + (equipCosts[cat] || 0), 0)
                    const totalMiles = Array.from(fuelByDriver.values()).reduce((s, d) => s + d.fuelMiles, 0)
                    const totalPer100k = totalMiles > 0 ? (totalCost / totalMiles) * 100000 : 0
                    return (
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                        <td className="px-4 py-3 text-sm">Total</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalCost)}</td>
                        <td className="px-4 py-3 text-sm text-right">{totalPer100k > 0 ? formatCurrency(totalPer100k) : '-'}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              Cost per 100k miles based on {formatNumber(Array.from(fuelByDriver.values()).reduce((s, d) => s + d.fuelMiles, 0))} total fuel miles
            </div>
          </div>
        )}

        {/* Summary Cards - Expenses tab */}
        {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Expenses ({selectedYear})</div>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(expenseReportData.totalAmount)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Categories</div>
            <div className="text-3xl font-bold text-brand">{expenseReportData.categories.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Entries</div>
            <div className="text-3xl font-bold text-gray-700">{expenseReportData.categories.reduce((s, c) => s + c.entries.length, 0)}</div>
          </div>
        </div>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Entries</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseReportData.categories.map((cat) => {
                    const isExpanded = expandedDrivers.has(cat.name.hashCode?.() || cat.name.length)
                    const catKey = cat.name.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
                    const isCatExpanded = expandedDrivers.has(catKey)
                    return (
                      <React.Fragment key={cat.name}>
                        <tr
                          className="border-t-2 border-gray-300 cursor-pointer hover:bg-gray-50 bg-red-50/30"
                          onClick={() => toggleDriver(catKey)}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {cat.entries.length > 0 ? (
                                isCatExpanded ? <ChevronDown className="h-4 w-4 text-gray-600" /> : <ChevronRight className="h-4 w-4 text-gray-600" />
                              ) : <span className="w-4" />}
                              {cat.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{cat.entries.length}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(cat.total)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-600">
                            {expenseReportData.totalAmount > 0 ? ((cat.total / expenseReportData.totalAmount) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        {isCatExpanded && cat.entries
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((entry) => (
                          <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700 pl-12">
                              {entry.description || entry.category}
                              {entry.vendor && <span className="text-gray-500 ml-2">({entry.vendor})</span>}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-500">{entry.date}</td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">{formatCurrency(entry.amount)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-500">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">{entry.cost_type}</span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-gray-400 bg-gray-100">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">
                      {expenseReportData.categories.reduce((s, c) => s + c.entries.length, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(expenseReportData.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Table - Drivers/Owners */}
      </div>
    </Layout>
  )
}
