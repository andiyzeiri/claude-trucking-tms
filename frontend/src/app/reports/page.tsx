'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Download, Search, ChevronRight, ChevronDown, TrendingUp, Users, Truck } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'
import { useDrivers } from '@/hooks/use-drivers'
import { useExpenses } from '@/hooks/use-expenses'
import { useFuel } from '@/hooks/use-fuel'

// Helper function to get ISO week number and year
function getISOWeekInfo(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return {
    year: d.getUTCFullYear(),
    week: weekNumber,
    label: `Week ${weekNumber}, ${d.getUTCFullYear()}`
  }
}

// Helper function to get date range for a week
function getWeekDateRange(date: Date) {
  const dayOfWeek = date.getDay()
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday,
    end: sunday,
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
}

interface WeekData {
  weekKey: string
  weekLabel: string
  weekDateRange: string
  gross: number
  miles: number
  expenses: number
  profit: number
  loadCount: number
}

interface DriverReportData {
  driver_id: number
  driver_name: string
  driver_type: 'company' | 'owner_operator'
  weeks: WeekData[]
  totals: {
    gross: number
    miles: number
    expenses: number
    profit: number
    loadCount: number
  }
}

type TabType = 'drivers' | 'owners'

export default function ReportsPage() {
  const { data: loadsData, isLoading: loadsLoading } = useLoads()
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(1, 1000)
  const { data: fuelData, isLoading: fuelLoading } = useFuel()

  const loads = loadsData?.items || []
  const drivers = driversData?.items || []
  const expenses = expensesData?.items || []
  const fuel = fuelData || []

  const [activeTab, setActiveTab] = useState<TabType>('drivers')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedDrivers, setExpandedDrivers] = useState<Set<number>>(new Set())

  const isLoading = loadsLoading || driversLoading || expensesLoading || fuelLoading

  // Build expense lookup by driver and week
  const expensesByDriverWeek = useMemo(() => {
    const map = new Map<string, number>()

    // Add expenses
    expenses.forEach(expense => {
      if (!expense.driver_id || !expense.date) return
      const expenseDate = new Date(expense.date + 'T00:00:00')
      const weekInfo = getISOWeekInfo(expenseDate)
      const key = `${expense.driver_id}-${weekInfo.year}-${weekInfo.week}`
      map.set(key, (map.get(key) || 0) + Number(expense.amount || 0))
    })

    // Add fuel
    fuel.forEach(f => {
      if (!f.driver_id || !f.date) return
      const fuelDate = new Date(f.date + 'T00:00:00')
      const weekInfo = getISOWeekInfo(fuelDate)
      const key = `${f.driver_id}-${weekInfo.year}-${weekInfo.week}`
      map.set(key, (map.get(key) || 0) + Number(f.total_amount || 0))
    })

    return map
  }, [expenses, fuel])

  // Process data grouped by driver and week
  const reportData = useMemo(() => {
    const driverMap = new Map<number, DriverReportData>()

    // Initialize with all drivers
    drivers.forEach(driver => {
      driverMap.set(driver.id, {
        driver_id: driver.id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        driver_type: driver.driver_type || 'company',
        weeks: [],
        totals: { gross: 0, miles: 0, expenses: 0, profit: 0, loadCount: 0 }
      })
    })

    // Group loads by driver and week
    const weekMap = new Map<string, WeekData>()

    loads.forEach(load => {
      if (!load.driver_id || !load.pickup_date) return

      const loadDate = new Date(load.pickup_date + 'T00:00:00')
      const weekInfo = getISOWeekInfo(loadDate)
      const weekDateRange = getWeekDateRange(loadDate)
      const driverWeekKey = `${load.driver_id}-${weekInfo.year}-${weekInfo.week}`

      if (!weekMap.has(driverWeekKey)) {
        weekMap.set(driverWeekKey, {
          weekKey: `${weekInfo.year}-W${weekInfo.week}`,
          weekLabel: weekInfo.label,
          weekDateRange: weekDateRange.label,
          gross: 0,
          miles: 0,
          expenses: 0,
          profit: 0,
          loadCount: 0
        })
      }

      const weekData = weekMap.get(driverWeekKey)!
      weekData.gross += Number(load.rate || 0)
      weekData.miles += Number(load.miles || 0)
      weekData.loadCount += 1
    })

    // Add expense data to weeks and build driver data
    weekMap.forEach((weekData, key) => {
      const [driverIdStr, year, week] = key.split('-')
      const driverId = parseInt(driverIdStr)
      const expenseKey = `${driverId}-${year}-${week}`
      weekData.expenses = expensesByDriverWeek.get(expenseKey) || 0
      weekData.profit = weekData.gross - weekData.expenses

      const driverData = driverMap.get(driverId)
      if (driverData) {
        driverData.weeks.push(weekData)
        driverData.totals.gross += weekData.gross
        driverData.totals.miles += weekData.miles
        driverData.totals.expenses += weekData.expenses
        driverData.totals.profit += weekData.profit
        driverData.totals.loadCount += weekData.loadCount
      }
    })

    // Sort weeks within each driver (most recent first)
    driverMap.forEach(driverData => {
      driverData.weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    })

    return Array.from(driverMap.values())
  }, [loads, drivers, expensesByDriverWeek])

  // Filter by tab and search
  const filteredData = useMemo(() => {
    return reportData
      .filter(d => {
        // Filter by tab
        if (activeTab === 'drivers' && d.driver_type !== 'company') return false
        if (activeTab === 'owners' && d.driver_type !== 'owner_operator') return false

        // Filter by search
        if (searchTerm && !d.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false
        }

        // Only show drivers with data
        return d.totals.loadCount > 0
      })
      .sort((a, b) => a.driver_name.localeCompare(b.driver_name))
  }, [reportData, activeTab, searchTerm])

  // Calculate grand totals for current tab
  const grandTotals = useMemo(() => {
    return filteredData.reduce((acc, driver) => ({
      gross: acc.gross + driver.totals.gross,
      miles: acc.miles + driver.totals.miles,
      expenses: acc.expenses + driver.totals.expenses,
      profit: acc.profit + driver.totals.profit,
      loadCount: acc.loadCount + driver.totals.loadCount
    }), { gross: 0, miles: 0, expenses: 0, profit: 0, loadCount: 0 })
  }, [filteredData])

  const toggleDriver = (driverId: number) => {
    const newExpanded = new Set(expandedDrivers)
    if (newExpanded.has(driverId)) {
      newExpanded.delete(driverId)
    } else {
      newExpanded.add(driverId)
    }
    setExpandedDrivers(newExpanded)
  }

  const expandAll = () => {
    const allDriverIds = new Set(filteredData.map(d => d.driver_id))
    setExpandedDrivers(allDriverIds)
  }

  const collapseAll = () => {
    setExpandedDrivers(new Set())
  }

  // Export to CSV
  const exportToCSV = () => {
    const rows: string[] = ['Driver,Type,Week,Gross,Miles,Expenses,Profit']

    filteredData.forEach(driver => {
      driver.weeks.forEach(week => {
        rows.push([
          driver.driver_name,
          driver.driver_type === 'owner_operator' ? 'Owner Operator' : 'Company',
          week.weekLabel,
          week.gross.toFixed(2),
          week.miles,
          week.expenses.toFixed(2),
          week.profit.toFixed(2)
        ].join(','))
      })
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-report-${Date.now()}.csv`
    a.click()
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="page-reports space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
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
            <p className="text-gray-600">Financial reports grouped by driver and week</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={expandAll} variant="outline">
              Expand All
            </Button>
            <Button onClick={collapseAll} variant="outline">
              Collapse All
            </Button>
            <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'drivers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Company Drivers
            </button>
            <button
              onClick={() => setActiveTab('owners')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'owners'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Owner Operators
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Loads</div>
            <div className="text-3xl font-bold text-blue-600">{grandTotals.loadCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Gross</div>
            <div className="text-3xl font-bold" style={{color: '#1a5f2a'}}>{formatCurrency(grandTotals.gross)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Expenses</div>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(grandTotals.expenses)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Profit</div>
            <div className="text-3xl font-bold" style={{color: grandTotals.profit >= 0 ? '#1a5f2a' : '#b91c1c'}}>
              {formatCurrency(grandTotals.profit)}
            </div>
          </div>
        </div>

        {/* Data Table */}
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Found</h2>
              <p className="text-gray-600">
                {activeTab === 'drivers'
                  ? 'No company drivers with loads found.'
                  : 'No owner operators with loads found.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">
                      {activeTab === 'drivers' ? 'Driver' : 'Owner'} / Week
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Expenses
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] bg-green-50">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredData.map((driverData) => {
                    const isExpanded = expandedDrivers.has(driverData.driver_id)

                    return (
                      <React.Fragment key={driverData.driver_id}>
                        {/* Driver Row */}
                        <tr
                          className="border-t-2 border-gray-300 cursor-pointer hover:bg-groupDriver/80 bg-groupDriver"
                          onClick={() => toggleDriver(driverData.driver_id)}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              )}
                              <span>{driverData.driver_name}</span>
                              <span className="text-gray-500 font-normal">
                                ({driverData.totals.loadCount} loads, {driverData.weeks.length} weeks)
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{color: '#1a5f2a'}}>
                            {formatCurrency(driverData.totals.gross)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {driverData.totals.miles.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                            {formatCurrency(driverData.totals.expenses)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold" style={{
                            backgroundColor: 'rgba(26, 95, 42, 0.1)',
                            color: driverData.totals.profit >= 0 ? '#1a5f2a' : '#b91c1c'
                          }}>
                            {formatCurrency(driverData.totals.profit)}
                          </td>
                        </tr>

                        {/* Week Rows */}
                        {isExpanded && driverData.weeks.map((week) => (
                          <tr
                            key={week.weekKey}
                            className="border-t border-gray-200 bg-groupWeek hover:bg-groupWeek/80"
                          >
                            <td className="px-4 py-2 text-sm text-gray-800 pl-12">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{week.weekLabel}</span>
                                <span className="text-gray-500 text-xs">({week.weekDateRange})</span>
                                <span className="text-gray-500">- {week.loadCount} loads</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold" style={{color: '#1a5f2a'}}>
                              {formatCurrency(week.gross)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                              {week.miles.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">
                              {formatCurrency(week.expenses)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold" style={{
                              backgroundColor: 'rgba(26, 95, 42, 0.05)',
                              color: week.profit >= 0 ? '#1a5f2a' : '#b91c1c'
                            }}>
                              {formatCurrency(week.profit)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
