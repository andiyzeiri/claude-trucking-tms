'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Download, Search, ChevronRight, ChevronDown, TrendingUp } from 'lucide-react'
import { useLoads } from '@/hooks/use-loads'

// Helper function to get week number and year
function getWeekInfo(date: Date) {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return {
    year: date.getFullYear(),
    week: weekNumber,
    label: `Week ${weekNumber}, ${date.getFullYear()}`
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

interface ProcessedLoad {
  id: number
  date: string
  driver: string
  driver_id: number | null
  truck: string
  truck_id: number | null
  rate: number
  miles: number
  expense: number
  profit: number
}

interface WeekGroup {
  weekKey: string
  weekLabel: string
  weekDateRange: string
  loads: ProcessedLoad[]
  totals: {
    rate: number
    miles: number
    expense: number
    profit: number
  }
}

interface DriverGroup {
  driver: string
  driver_id: number | null
  weeks: WeekGroup[]
  totals: {
    rate: number
    miles: number
    expense: number
    profit: number
    loadsCount: number
  }
}

export default function ReportsPage() {
  const { data: loadsData, isLoading } = useLoads()
  const loads = loadsData?.items || []
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set())
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  // Process loads to include calculated profit
  const processedLoads = useMemo(() => {
    return loads.map(load => {
      const estimatedExpense = (load.rate || 0) * 0.65 // Assume 65% of rate goes to expenses
      const profit = (load.rate || 0) - estimatedExpense

      return {
        id: load.id,
        date: load.pickup_date || load.created_at,
        driver: load.driver ? `${load.driver.first_name} ${load.driver.last_name}` : 'Unassigned',
        driver_id: load.driver_id,
        truck: load.truck ? load.truck.truck_number : 'N/A',
        truck_id: load.truck_id,
        rate: load.rate || 0,
        miles: load.miles || 0,
        expense: estimatedExpense,
        profit: profit,
      }
    })
  }, [loads])

  // Group loads by driver and week
  const groupedData = useMemo(() => {
    const filtered = processedLoads.filter(load => {
      const matchesSearch = searchTerm === '' ||
        load.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.truck.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })

    const driverMap = new Map<string, DriverGroup>()

    filtered.forEach(load => {
      if (!load.date) return

      const loadDate = new Date(load.date)
      const weekInfo = getWeekInfo(loadDate)
      const weekDateRange = getWeekDateRange(loadDate)
      const weekKey = `${weekInfo.year}-W${weekInfo.week}`
      const driverKey = load.driver

      if (!driverMap.has(driverKey)) {
        driverMap.set(driverKey, {
          driver: load.driver,
          driver_id: load.driver_id,
          weeks: [],
          totals: { rate: 0, miles: 0, expense: 0, profit: 0, loadsCount: 0 }
        })
      }

      const driverGroup = driverMap.get(driverKey)!
      let weekGroup = driverGroup.weeks.find(w => w.weekKey === weekKey)

      if (!weekGroup) {
        weekGroup = {
          weekKey,
          weekLabel: weekInfo.label,
          weekDateRange: weekDateRange.label,
          loads: [],
          totals: { rate: 0, miles: 0, expense: 0, profit: 0 }
        }
        driverGroup.weeks.push(weekGroup)
      }

      weekGroup.loads.push(load)
      weekGroup.totals.rate += load.rate
      weekGroup.totals.miles += load.miles
      weekGroup.totals.expense += load.expense
      weekGroup.totals.profit += load.profit

      driverGroup.totals.rate += load.rate
      driverGroup.totals.miles += load.miles
      driverGroup.totals.expense += load.expense
      driverGroup.totals.profit += load.profit
      driverGroup.totals.loadsCount += 1
    })

    // Sort weeks within each driver (most recent first)
    driverMap.forEach(driverGroup => {
      driverGroup.weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    })

    return Array.from(driverMap.values()).sort((a, b) => a.driver.localeCompare(b.driver))
  }, [processedLoads, searchTerm])

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return groupedData.reduce((acc, driver) => ({
      rate: acc.rate + driver.totals.rate,
      miles: acc.miles + driver.totals.miles,
      expense: acc.expense + driver.totals.expense,
      profit: acc.profit + driver.totals.profit,
      loadsCount: acc.loadsCount + driver.totals.loadsCount
    }), { rate: 0, miles: 0, expense: 0, profit: 0, loadsCount: 0 })
  }, [groupedData])

  const toggleDriver = (driver: string) => {
    const newExpanded = new Set(expandedDrivers)
    if (newExpanded.has(driver)) {
      newExpanded.delete(driver)
    } else {
      newExpanded.add(driver)
    }
    setExpandedDrivers(newExpanded)
  }

  const toggleWeek = (weekKey: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey)
    } else {
      newExpanded.add(weekKey)
    }
    setExpandedWeeks(newExpanded)
  }

  const expandAll = () => {
    const allDrivers = new Set(groupedData.map(d => d.driver))
    const allWeeks = new Set(groupedData.flatMap(d => d.weeks.map(w => w.weekKey)))
    setExpandedDrivers(allDrivers)
    setExpandedWeeks(allWeeks)
  }

  const collapseAll = () => {
    setExpandedDrivers(new Set())
    setExpandedWeeks(new Set())
  }

  // Export to CSV
  const exportToCSV = () => {
    const rows: string[] = ['Driver,Week,Date,Truck,Rate,Miles,Expense,Profit']

    groupedData.forEach(driver => {
      driver.weeks.forEach(week => {
        week.loads.forEach(load => {
          rows.push([
            driver.driver,
            week.weekLabel,
            load.date ? new Date(load.date).toLocaleDateString() : '',
            load.truck,
            load.rate,
            load.miles,
            load.expense.toFixed(2),
            load.profit.toFixed(2)
          ].join(','))
        })
      })
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loads-report-grouped-${Date.now()}.csv`
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
            <p className="text-gray-600">Loads grouped by driver and week</p>
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by driver or truck..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Loads</div>
            <div className="text-3xl font-bold text-blue-600">{grandTotals.loadsCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(grandTotals.rate)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Expenses</div>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(grandTotals.expense)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Profit</div>
            <div className={`text-3xl font-bold ${grandTotals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(grandTotals.profit)}
            </div>
          </div>
        </div>

        {/* Grouped Table */}
        {groupedData.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Loads Found</h2>
              <p className="text-gray-600">No loads match your current filters.</p>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                      Driver / Week / Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Truck
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Expense
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] bg-green-50">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {groupedData.map((driverGroup) => {
                    const isDriverExpanded = expandedDrivers.has(driverGroup.driver)

                    return (
                      <React.Fragment key={driverGroup.driver}>
                        {/* Driver Row */}
                        <tr
                          className="border-t-2 border-gray-300 cursor-pointer hover:bg-blue-50 bg-blue-50"
                          onClick={() => toggleDriver(driverGroup.driver)}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {isDriverExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              )}
                              <span>{driverGroup.driver}</span>
                              <span className="text-gray-500 font-normal">({driverGroup.totals.loadsCount} loads)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-600">
                            {driverGroup.weeks.length} weeks
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                            {formatCurrency(driverGroup.totals.rate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {driverGroup.totals.miles.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                            {formatCurrency(driverGroup.totals.expense)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-bold bg-green-100 ${driverGroup.totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(driverGroup.totals.profit)}
                          </td>
                        </tr>

                        {/* Week Rows */}
                        {isDriverExpanded && driverGroup.weeks.map((weekGroup) => {
                          const isWeekExpanded = expandedWeeks.has(weekGroup.weekKey)

                          return (
                            <React.Fragment key={weekGroup.weekKey}>
                              <tr
                                className="border-t border-gray-200 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                onClick={() => toggleWeek(weekGroup.weekKey)}
                              >
                                <td className="px-4 py-2 text-sm font-semibold text-gray-800 pl-12">
                                  <div className="flex items-center gap-2">
                                    {isWeekExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-gray-600" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-600" />
                                    )}
                                    <span>{weekGroup.weekLabel}</span>
                                    <span className="text-gray-500 text-xs">({weekGroup.weekDateRange})</span>
                                    <span className="text-gray-500 font-normal">- {weekGroup.loads.length} loads</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600"></td>
                                <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">
                                  {formatCurrency(weekGroup.totals.rate)}
                                </td>
                                <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                                  {weekGroup.totals.miles.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">
                                  {formatCurrency(weekGroup.totals.expense)}
                                </td>
                                <td className={`px-4 py-2 text-sm text-right font-semibold bg-green-50 ${weekGroup.totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {formatCurrency(weekGroup.totals.profit)}
                                </td>
                              </tr>

                              {/* Load Rows */}
                              {isWeekExpanded && weekGroup.loads.map((load) => (
                                <tr key={load.id} className="hover:bg-gray-50 border-b border-gray-100">
                                  <td className="px-4 py-2 text-sm text-gray-900 pl-20">
                                    {load.date ? new Date(load.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 'N/A'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">
                                    {load.truck}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-green-600">
                                    {formatCurrency(load.rate)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-900">
                                    {load.miles.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-red-600">
                                    {formatCurrency(load.expense)}
                                  </td>
                                  <td className={`px-4 py-2 text-sm text-right font-semibold bg-green-50 ${load.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {formatCurrency(load.profit)}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          )
                        })}
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
