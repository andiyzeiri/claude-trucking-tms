'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ChevronRight, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, Copy } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'

// Generate 52 weeks starting from Monday, December 30, 2024
function generateWeeks() {
  const weeks = []
  // Use Date constructor to avoid timezone issues (2024, 11=December, 30)
  const startDate = new Date(2024, 11, 30) // Monday, December 30, 2024

  for (let i = 0; i < 52; i++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(startDate.getDate() + (i * 7))

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // Sunday

    const weekNumber = i + 1
    const year = weekStart.getFullYear()

    weeks.push({
      weekNumber,
      year,
      startDate: weekStart,
      endDate: weekEnd,
      label: `Week ${weekNumber} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
    })
  }

  return weeks
}

interface DriverPayrollData {
  driver_id: number
  driver_name: string
  weeks: {
    [weekNumber: number]: {
      gross: number
      extra: number
      dispatch_fee: number
      insurance: number
      fuel: number
      parking: number
      trailer: number
      misc: number
      miles: number
      check_amount: number
    }
  }
}

type EditingCell = {
  weekNumber: number
  driverId: number
  field: string
} | null

export default function PayrollPage() {
  const { data: driversData, isLoading } = useDrivers()
  const drivers = driversData?.items || []
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])) // Week 1 expanded by default
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [sortField, setSortField] = useState<string>('weekNumber')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, weekNumber: number, driverId: number} | null>(null)

  const weeks = useMemo(() => generateWeeks(), [])

  // Mock payroll data - in real app, this would come from API
  const payrollData: DriverPayrollData[] = useMemo(() => {
    return drivers.map(driver => ({
      driver_id: driver.id,
      driver_name: `${driver.first_name} ${driver.last_name}`,
      weeks: {} // Empty for now - will be populated by API
    }))
  }, [drivers])

  const toggleWeek = (weekNumber: number) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekNumber)) {
      newExpanded.delete(weekNumber)
    } else {
      newExpanded.add(weekNumber)
    }
    setExpandedWeeks(newExpanded)
  }

  const expandAll = () => {
    setExpandedWeeks(new Set(weeks.map(w => w.weekNumber)))
  }

  const collapseAll = () => {
    setExpandedWeeks(new Set())
  }

  const goToCurrentWeek = () => {
    const today = new Date()
    const currentWeek = weeks.find(week =>
      today >= week.startDate && today <= week.endDate
    )
    if (currentWeek) {
      setExpandedWeeks(new Set([currentWeek.weekNumber]))
      // Scroll to the week
      const element = document.getElementById(`week-${currentWeek.weekNumber}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Calculate week totals
  const getWeekTotals = (weekNumber: number) => {
    const totals = {
      gross: 0,
      extra: 0,
      dispatch_fee: 0,
      insurance: 0,
      fuel: 0,
      parking: 0,
      trailer: 0,
      misc: 0,
      miles: 0,
      check_amount: 0
    }

    payrollData.forEach(driverData => {
      const weekData = driverData.weeks[weekNumber]
      if (weekData) {
        totals.gross += weekData.gross
        totals.extra += weekData.extra
        totals.dispatch_fee += weekData.dispatch_fee
        totals.insurance += weekData.insurance
        totals.fuel += weekData.fuel
        totals.parking += weekData.parking
        totals.trailer += weekData.trailer
        totals.misc += weekData.misc
        totals.miles += weekData.miles
        totals.check_amount += weekData.check_amount
      }
    })

    return totals
  }

  // Calculate grand totals across all 52 weeks
  const grandTotals = useMemo(() => {
    const totals = {
      gross: 0,
      extra: 0,
      dispatch_fee: 0,
      insurance: 0,
      fuel: 0,
      parking: 0,
      trailer: 0,
      misc: 0,
      miles: 0,
      check_amount: 0
    }

    weeks.forEach(week => {
      const weekTotals = getWeekTotals(week.weekNumber)
      totals.gross += weekTotals.gross
      totals.extra += weekTotals.extra
      totals.dispatch_fee += weekTotals.dispatch_fee
      totals.insurance += weekTotals.insurance
      totals.fuel += weekTotals.fuel
      totals.parking += weekTotals.parking
      totals.trailer += weekTotals.trailer
      totals.misc += weekTotals.misc
      totals.miles += weekTotals.miles
      totals.check_amount += weekTotals.check_amount
    })

    return totals
  }, [payrollData, weeks])

  if (isLoading) {
    return (
      <Layout>
        <div className="page-payroll space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
              <p className="text-gray-600">52-week driver payroll overview</p>
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">Loading payroll data...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent, weekNumber: number, driverId: number) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      weekNumber,
      driverId
    })
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const isEditing = (weekNumber: number, driverId: number, field: string) => {
    return editingCell?.weekNumber === weekNumber && editingCell?.driverId === driverId && editingCell?.field === field
  }

  const startEdit = (weekNumber: number, driverId: number, field: string) => {
    setEditingCell({ weekNumber, driverId, field })
  }

  const stopEdit = () => {
    setEditingCell(null)
  }

  // Calculate stats for the current week
  const currentWeekStats = useMemo(() => {
    const today = new Date()
    const currentWeek = weeks.find(week =>
      today >= week.startDate && today <= week.endDate
    )
    if (!currentWeek) return { total: 0, paid: 0, pending: 0, miles: 0 }

    const totals = getWeekTotals(currentWeek.weekNumber)
    return {
      total: totals.check_amount,
      paid: totals.check_amount > 0 ? totals.check_amount : 0,
      pending: 0, // TODO: Add pending logic
      miles: totals.miles
    }
  }, [payrollData, weeks])

  return (
    <Layout>
      <div className="page-payroll space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="text-gray-600">52-week driver payroll overview</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={goToCurrentWeek} variant="outline">
              Go to Current Week
            </Button>
            <Button onClick={expandAll} variant="outline">
              Expand All
            </Button>
            <Button onClick={collapseAll} variant="outline">
              Collapse All
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Week Pay</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(currentWeekStats.total)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(currentWeekStats.paid)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(currentWeekStats.pending)}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Miles This Week</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{currentWeekStats.miles.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Grand Totals Summary */}
        {drivers.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider min-w-[300px]">
                      52-Week Totals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider min-w-[200px]">
                      All Drivers
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Extra
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[110px]">
                      Dispatch Fee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Insurance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Parking
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Trailer
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[100px]">
                      Misc
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[90px]">
                      Miles
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider min-w-[120px]">
                      Total Pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white border-b-2 border-gray-300">
                    <td className="px-4 py-4 text-sm font-bold text-gray-900">
                      Year 2025
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-blue-600">
                      {payrollData.length} drivers
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.dispatch_fee)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.insurance)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.fuel)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.parking)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.trailer)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {formatCurrency(grandTotals.misc)}
                    </td>
                    <td className="px-4 py-4 text-base font-bold text-right text-gray-900">
                      {grandTotals.miles.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-lg font-bold text-right text-green-700">
                      {formatCurrency(grandTotals.check_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payroll Table */}
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Drivers</h2>
              <p className="text-gray-600">Add drivers to start tracking payroll.</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none sticky left-0 z-10" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, backgroundColor: 'var(--cell-background-header)', minWidth: '300px'}} onClick={() => handleSort('weekNumber')}>
                      <div className="flex items-center gap-1">
                        Week
                        {sortField === 'weekNumber' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '200px'}} onClick={() => handleSort('driver')}>
                      <div className="flex items-center gap-1">
                        Driver
                        {sortField === 'driver' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('gross')}>
                      <div className="flex items-center gap-1 justify-end">
                        Gross
                        {sortField === 'gross' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('extra')}>
                      <div className="flex items-center gap-1 justify-end">
                        Extra
                        {sortField === 'extra' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '110px'}} onClick={() => handleSort('dispatch_fee')}>
                      <div className="flex items-center gap-1 justify-end">
                        Dispatch Fee
                        {sortField === 'dispatch_fee' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('insurance')}>
                      <div className="flex items-center gap-1 justify-end">
                        Insurance
                        {sortField === 'insurance' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('fuel')}>
                      <div className="flex items-center gap-1 justify-end">
                        Fuel
                        {sortField === 'fuel' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('parking')}>
                      <div className="flex items-center gap-1 justify-end">
                        Parking
                        {sortField === 'parking' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('trailer')}>
                      <div className="flex items-center gap-1 justify-end">
                        Trailer
                        {sortField === 'trailer' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '100px'}} onClick={() => handleSort('misc')}>
                      <div className="flex items-center gap-1 justify-end">
                        Misc
                        {sortField === 'misc' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b cursor-pointer hover:bg-gray-100 select-none" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '90px'}} onClick={() => handleSort('miles')}>
                      <div className="flex items-center gap-1 justify-end">
                        Miles
                        {sortField === 'miles' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500, minWidth: '120px', backgroundColor: 'var(--cell-background-highlight)'}}>
                      Pay
                    </th>
                  </tr>
                </thead>
                <tbody style={{backgroundColor: 'var(--cell-background-base)'}}>
                  {weeks.map((week, weekIndex) => {
                    const isExpanded = expandedWeeks.has(week.weekNumber)
                    const weekTotals = getWeekTotals(week.weekNumber)
                    const hasData = weekTotals.check_amount > 0

                    return (
                      <React.Fragment key={week.weekNumber}>
                        {/* Week Header Row */}
                        <tr
                          id={`week-${week.weekNumber}`}
                          className="border-t-2 cursor-pointer transition-colors"
                          style={{
                            borderColor: 'var(--cell-borderColor)',
                            backgroundColor: hasData ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.02)'
                          }}
                          onClick={() => toggleWeek(week.weekNumber)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--row-background-cursor)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = hasData ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.02)'
                          }}
                        >
                          <td className="px-3 py-2.5 border-r sticky left-0 z-10" style={{borderColor: 'var(--cell-borderColor)', backgroundColor: 'inherit'}}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" style={{color: 'var(--colors-foreground-muted)'}} />
                              ) : (
                                <ChevronRight className="h-4 w-4" style={{color: 'var(--colors-foreground-muted)'}} />
                              )}
                              <span style={{fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>{week.label}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-muted)'}}>
                            {payrollData.length} drivers
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.gross)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.extra)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.dispatch_fee)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.insurance)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.fuel)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.parking)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.trailer)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {formatCurrency(weekTotals.misc)}
                          </td>
                          <td className="px-3 py-2.5 border-r text-right" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 600, color: 'var(--colors-foreground-default)'}}>
                            {weekTotals.miles.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right" style={{fontSize: '14px', fontWeight: 700, color: 'rgb(21, 128, 61)', backgroundColor: 'rgba(34, 197, 94, 0.1)'}}>
                            {formatCurrency(weekTotals.check_amount)}
                          </td>
                        </tr>

                        {/* Driver Rows (shown when expanded) */}
                        {isExpanded && payrollData.map((driverData, driverIndex) => {
                          const weekData = driverData.weeks[week.weekNumber]
                          const rowIndex = weekIndex * payrollData.length + driverIndex
                          const isEvenRow = rowIndex % 2 === 0
                          const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

                          return (
                            <tr
                              key={`${week.weekNumber}-${driverData.driver_id}`}
                              className="border-b transition-colors"
                              style={{
                                borderColor: 'var(--cell-borderColor)',
                                backgroundColor: defaultBgColor
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--row-background-cursor)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = defaultBgColor
                              }}
                              onContextMenu={(e) => handleContextMenu(e, week.weekNumber, driverData.driver_id)}
                            >
                              <td className="px-3 py-2.5 border-r sticky left-0 z-10" style={{borderColor: 'var(--cell-borderColor)', backgroundColor: 'inherit'}}>
                                {/* Empty for driver rows */}
                              </td>
                              <td className="px-3 py-2.5 border-r pl-8" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', fontWeight: 500, color: 'rgb(37, 99, 235)'}}>
                                {driverData.driver_name}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'gross')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'gross') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.gross || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.gross) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'extra')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'extra') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.extra || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.extra) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'dispatch_fee')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'dispatch_fee') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.dispatch_fee || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.dispatch_fee) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'insurance')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'insurance') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.insurance || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.insurance) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'fuel')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'fuel') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.fuel || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.fuel) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'parking')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'parking') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.parking || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.parking) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'trailer')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'trailer') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.trailer || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.trailer) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'misc')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'misc') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.misc || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? formatCurrency(weekData.misc) : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-r text-right cursor-pointer hover:bg-blue-50 rounded" style={{borderColor: 'var(--cell-borderColor)', fontSize: '13px', color: 'var(--colors-foreground-default)'}} onClick={() => startEdit(week.weekNumber, driverData.driver_id, 'miles')}>
                                {isEditing(week.weekNumber, driverData.driver_id, 'miles') ? (
                                  <Input
                                    type="number"
                                    value={weekData?.miles || 0}
                                    onBlur={stopEdit}
                                    autoFocus
                                    className="h-8 text-sm text-right"
                                  />
                                ) : (
                                  <span>{weekData ? weekData.miles.toLocaleString() : '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right" style={{fontSize: '13px', fontWeight: 600, color: 'rgb(21, 128, 61)', backgroundColor: 'rgba(34, 197, 94, 0.05)'}}>
                                {weekData ? formatCurrency(weekData.check_amount) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white border-t-2 shadow-lg" style={{borderColor: 'var(--cell-borderColor)'}}>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2.5 text-sm font-medium sticky left-0 bg-gray-50">52 Weeks</td>
                    <td className="px-3 py-2.5 text-sm font-medium">{payrollData.length} drivers</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-green-700">
                      {formatCurrency(grandTotals.gross)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-green-700">
                      {formatCurrency(grandTotals.extra)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.dispatch_fee)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.insurance)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.fuel)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.parking)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.trailer)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-red-700">
                      {formatCurrency(grandTotals.misc)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-right text-blue-700">
                      {grandTotals.miles.toLocaleString()} mi
                    </td>
                    <td className="px-3 py-2.5 text-lg font-bold text-right" style={{color: 'rgb(21, 128, 61)'}}>
                      {formatCurrency(grandTotals.check_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                // TODO: Add edit functionality
                setContextMenu(null)
              }}
            >
              <Edit2 className="h-4 w-4 text-blue-600" />
              <span>Edit Payroll</span>
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                // TODO: Add copy functionality
                setContextMenu(null)
              }}
            >
              <Copy className="h-4 w-4 text-green-600" />
              <span>Copy to Next Week</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
              onClick={() => {
                // TODO: Add delete functionality
                setContextMenu(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Payroll</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
