'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, Trash2, Truck, BarChart3, GripVertical } from 'lucide-react'
import { useTrucks } from '@/hooks/use-trucks'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { formatCurrency } from '@/lib/utils'
import { Fuel } from '@/types'

type EditingCell = {
  weekNumber: number
  truckId: number
  field: string
} | null

// Helper to get previous entry's ending miles for a truck
// Looks through all entries (sorted by year/week) to find the most recent prior entry
function getPreviousEndingMiles(
  sortedEntriesByTruck: Map<number, Array<{ isoYear: number, weekNumber: number, odometer: number | null }>>,
  currentYear: number,
  weekNum: number,
  truckId: number
): number | null {
  const truckEntries = sortedEntriesByTruck.get(truckId)
  if (!truckEntries || truckEntries.length === 0) return null

  // Find the most recent entry BEFORE the current week
  // Entries are sorted by year desc, week desc
  for (const entry of truckEntries) {
    // Check if this entry is before the current week
    if (entry.isoYear < currentYear || (entry.isoYear === currentYear && entry.weekNumber < weekNum)) {
      return entry.odometer
    }
  }
  return null
}

// Helper to get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNum
}

// Helper to get ISO week year (the year the week belongs to)
// e.g., Dec 30, 2024 is in Week 1 of 2025, so ISO week year is 2025
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

// Helper to get a date from a week number (ISO 8601) - matches loads page
function getDateFromWeekNumber(weekNumber: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()

  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(currentYear, 0, 4))

  // Get the Monday of week 1
  const dayNum = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum + 1)

  // Add weeks
  const targetDate = new Date(week1Monday)
  targetDate.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7)

  // Convert to local date
  return new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())
}

// Get week date range - matches loads page approach
function getWeekDateRange(weekNumber: number, year?: number): string {
  const date = getDateFromWeekNumber(weekNumber, year)

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

// Extended fuel entry with week info for local state
interface FuelEntryWithWeek extends Fuel {
  weekNumber: number
}

// Tab type - either 'summary' or a year number
type TabType = 'summary' | number

export default function FuelPage() {
  const { data: trucksData, isLoading: trucksLoading } = useTrucks()
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const createFuel = useCreateFuel()
  const updateFuel = useUpdateFuel()
  const deleteFuel = useDeleteFuel()

  const trucks = trucksData?.items || []
  const activeTrucksUnordered = trucks.filter(t => t.type === 'truck')

  // Truck ordering - persisted in localStorage
  const [truckOrder, setTruckOrder] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('fuel-truck-order')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const activeTrucks = useMemo(() => {
    if (truckOrder.length === 0) return activeTrucksUnordered
    const orderMap = new Map(truckOrder.map((id, idx) => [id, idx]))
    return [...activeTrucksUnordered].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? 999999
      const bIdx = orderMap.get(b.id) ?? 999999
      return aIdx - bIdx
    })
  }, [activeTrucksUnordered, truckOrder])

  // Drag state for reordering
  const dragTruckId = useRef<number | null>(null)
  const dragOverTruckId = useRef<number | null>(null)

  const handleDragStart = (truckId: number) => {
    dragTruckId.current = truckId
  }

  const handleDragOver = (e: React.DragEvent, truckId: number) => {
    e.preventDefault()
    dragOverTruckId.current = truckId
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromId = dragTruckId.current
    const toId = dragOverTruckId.current
    if (fromId == null || toId == null || fromId === toId) return

    const currentOrder = activeTrucks.map(t => t.id)
    const fromIdx = currentOrder.indexOf(fromId)
    const toIdx = currentOrder.indexOf(toId)
    if (fromIdx === -1 || toIdx === -1) return

    currentOrder.splice(fromIdx, 1)
    currentOrder.splice(toIdx, 0, fromId)

    setTruckOrder(currentOrder)
    localStorage.setItem('fuel-truck-order', JSON.stringify(currentOrder))
    dragTruckId.current = null
    dragOverTruckId.current = null
  }

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())
  const hasInitiallyCollapsed = useRef(false)
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // Convert API fuel entries to include week numbers and year
  const fuelEntriesWithYear = useMemo(() => {
    if (!fuelData) return []
    return fuelData.map(entry => {
      // Parse date as local time, not UTC (YYYY-MM-DD without time is parsed as UTC by default)
      const entryDate = new Date(entry.date + 'T00:00:00')
      return {
        ...entry,
        weekNumber: getWeekNumber(entryDate),
        isoYear: getISOWeekYear(entryDate)
      }
    })
  }, [fuelData])

  // Get available years from fuel data
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    years.add(currentYear) // Always include current year
    years.add(2025) // Always include 2025
    years.add(2024) // Always include 2024

    fuelEntriesWithYear.forEach(entry => {
      if (entry.isoYear >= 2020 && entry.isoYear <= currentYear + 2) {
        years.add(entry.isoYear)
      }
    })

    return Array.from(years).sort((a, b) => b - a) // Sort descending (newest first)
  }, [fuelEntriesWithYear])

  // Get selected year for year tab view
  const selectedYear = typeof activeTab === 'number' ? activeTab : new Date().getFullYear()

  // Filter fuel entries by selected year (only for year tab view)
  const fuelEntries: FuelEntryWithWeek[] = useMemo(() => {
    if (activeTab === 'summary') return []
    return fuelEntriesWithYear.filter(entry => entry.isoYear === activeTab)
  }, [fuelEntriesWithYear, activeTab])

  // Calculate summary data by truck (all time)
  const summaryByTruck = useMemo(() => {
    const truckMap = new Map<number, {
      truck_id: number
      truck_number: string
      totalMiles: number
      totalGallons: number
      totalFuelPrice: number
      totalDefPrice: number
      entryCount: number
      avgPricePerGallon: number
    }>()

    // Initialize with all trucks
    trucks.filter(t => t.type === 'truck').forEach(truck => {
      truckMap.set(truck.id, {
        truck_id: truck.id,
        truck_number: truck.truck_number,
        totalMiles: 0,
        totalGallons: 0,
        totalFuelPrice: 0,
        totalDefPrice: 0,
        entryCount: 0,
        avgPricePerGallon: 0
      })
    })

    // Group fuel entries by truck and calculate totals
    fuelEntriesWithYear.forEach(entry => {
      if (!entry.truck_id) return

      const truckData = truckMap.get(entry.truck_id)
      if (truckData) {
        truckData.totalGallons += Number(entry.gallons) || 0
        truckData.totalFuelPrice += Number(entry.total_amount) || 0
        truckData.totalDefPrice += Number(entry.def_price) || 0
        truckData.entryCount += 1
      }
    })

    // Calculate miles from odometer readings (difference between max and min for each truck)
    const odometerByTruck = new Map<number, number[]>()
    fuelEntriesWithYear.forEach(entry => {
      if (!entry.truck_id || !entry.odometer) return
      if (!odometerByTruck.has(entry.truck_id)) {
        odometerByTruck.set(entry.truck_id, [])
      }
      odometerByTruck.get(entry.truck_id)!.push(Number(entry.odometer))
    })

    odometerByTruck.forEach((readings, truckId) => {
      const truckData = truckMap.get(truckId)
      if (truckData && readings.length > 1) {
        const minOdometer = Math.min(...readings)
        const maxOdometer = Math.max(...readings)
        truckData.totalMiles = maxOdometer - minOdometer
      }
    })

    // Calculate average price per gallon
    truckMap.forEach(truckData => {
      if (truckData.totalGallons > 0) {
        truckData.avgPricePerGallon = truckData.totalFuelPrice / truckData.totalGallons
      }
    })

    return Array.from(truckMap.values())
      .filter(t => t.entryCount > 0 || t.totalGallons > 0 || t.totalFuelPrice > 0)
      .sort((a, b) => a.truck_number.localeCompare(b.truck_number))
  }, [fuelEntriesWithYear, trucks])

  // Calculate grand totals for summary
  const summaryTotals = useMemo(() => {
    return summaryByTruck.reduce((acc, truck) => ({
      totalMiles: acc.totalMiles + truck.totalMiles,
      totalGallons: acc.totalGallons + truck.totalGallons,
      totalFuelPrice: acc.totalFuelPrice + truck.totalFuelPrice,
      totalDefPrice: acc.totalDefPrice + truck.totalDefPrice,
    }), { totalMiles: 0, totalGallons: 0, totalFuelPrice: 0, totalDefPrice: 0 })
  }, [summaryByTruck])

  // Generate all 52 weeks
  const allWeeks = useMemo(() => {
    const weeks = []
    for (let i = 1; i <= 52; i++) {
      weeks.push(i)
    }
    return weeks
  }, [])

  // Create sorted entries by truck for weekly miles calculation (uses ALL fuel data, not filtered)
  const sortedEntriesByTruck = useMemo(() => {
    const truckMap = new Map<number, Array<{ isoYear: number, weekNumber: number, odometer: number | null }>>()

    // Process ALL fuel entries (not just filtered by year)
    fuelEntriesWithYear.forEach(entry => {
      if (!entry.truck_id) return

      if (!truckMap.has(entry.truck_id)) {
        truckMap.set(entry.truck_id, [])
      }

      truckMap.get(entry.truck_id)!.push({
        isoYear: entry.isoYear,
        weekNumber: entry.weekNumber,
        odometer: entry.odometer ? Number(entry.odometer) : null
      })
    })

    // Sort each truck's entries by year desc, week desc (most recent first)
    truckMap.forEach((entries) => {
      entries.sort((a, b) => {
        if (a.isoYear !== b.isoYear) return b.isoYear - a.isoYear
        return b.weekNumber - a.weekNumber
      })
    })

    return truckMap
  }, [fuelEntriesWithYear])

  // Group fuel entries by week and truck
  const fuelByWeekAndTruck = useMemo(() => {
    const grouped: Record<number, Record<number, FuelEntryWithWeek | null>> = {}

    allWeeks.forEach(weekNum => {
      grouped[weekNum] = {}
      activeTrucks.forEach(truck => {
        grouped[weekNum][truck.id] = null
      })
    })

    fuelEntries.forEach(entry => {
      if (grouped[entry.weekNumber] && entry.truck_id) {
        grouped[entry.weekNumber][entry.truck_id] = entry
      }
    })

    return grouped
  }, [fuelEntries, activeTrucks, allWeeks])

  // Initially collapse all weeks
  useEffect(() => {
    if (!hasInitiallyCollapsed.current && allWeeks.length > 0) {
      setCollapsedWeeks(new Set(allWeeks))
      hasInitiallyCollapsed.current = true
    }
  }, [allWeeks])

  const toggleWeek = (weekNum: number) => {
    const newCollapsed = new Set(collapsedWeeks)
    if (newCollapsed.has(weekNum)) {
      newCollapsed.delete(weekNum)
    } else {
      newCollapsed.add(weekNum)
    }
    setCollapsedWeeks(newCollapsed)
  }

  const handleCellClick = (weekNumber: number, truckId: number, field: string) => {
    const existing = fuelByWeekAndTruck[weekNumber]?.[truckId]
    setEditingCell({ weekNumber, truckId, field })
    if (existing) {
      setEditValues({
        id: existing.id,
        weekNumber,
        truckId,
        odometer: existing.odometer || 0,
        gallons: existing.gallons || 0,
        pricePerGallon: existing.price_per_gallon || 0,
        defGallons: existing.def_gallons || 0,
        defPrice: existing.def_price || 0,
        totalAmount: existing.total_amount || 0,
      })
    } else {
      setEditValues({
        weekNumber,
        truckId,
        odometer: 0,
        gallons: 0,
        pricePerGallon: 0,
        defGallons: 0,
        defPrice: 0,
        totalAmount: 0,
      })
    }
  }

  const handleCellChange = (field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const { weekNumber, truckId } = editingCell
    const existing = fuelByWeekAndTruck[weekNumber]?.[truckId]

    // Check if there's any meaningful data (including zero values that were explicitly set)
    const hasData =
      editValues.gallons > 0 ||
      editValues.totalAmount > 0 ||
      editValues.defGallons > 0 ||
      editValues.odometer > 0 ||
      editValues.pricePerGallon > 0 ||
      editValues.defPrice > 0

    if (hasData) {
      // Convert week number to date (Monday of that week)
      const weekDate = getDateFromWeekNumber(weekNumber, selectedYear)
      const dateStr = weekDate.toISOString().split('T')[0]

      // Build fuel data - use null checks instead of || to preserve zero values
      const fuelData = {
        date: dateStr,
        gallons: editValues.gallons ?? 0,
        price_per_gallon: editValues.pricePerGallon != null && editValues.pricePerGallon !== 0 ? editValues.pricePerGallon : undefined,
        def_gallons: editValues.defGallons != null && editValues.defGallons !== 0 ? editValues.defGallons : undefined,
        def_price: editValues.defPrice != null && editValues.defPrice !== 0 ? editValues.defPrice : undefined,
        total_amount: editValues.totalAmount ?? 0,
        odometer: editValues.odometer != null && editValues.odometer !== 0 ? editValues.odometer : undefined,
        truck_id: truckId,
      }

      try {
        if (existing) {
          await updateFuel.mutateAsync({ id: existing.id, data: fuelData })
        } else {
          await createFuel.mutateAsync(fuelData)
        }
      } catch (error: any) {
        console.error('Failed to save fuel entry:', error?.response?.data || error)
      }
    }

    setEditingCell(null)
  }

  const handleDeleteRow = async (weekNumber: number, truckId: number) => {
    const entry = fuelByWeekAndTruck[weekNumber]?.[truckId]
    if (entry && confirm('Delete this fuel entry?')) {
      try {
        await deleteFuel.mutateAsync(entry.id)
      } catch (error) {
        console.error('Failed to delete fuel entry:', error)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  if (trucksLoading || fuelLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  const renderFuelRow = (weekNum: number, truck: any, rowIndex: number) => {
    const entry = fuelByWeekAndTruck[weekNum]?.[truck.id]

    const isEditingField = (field: string) =>
      editingCell?.weekNumber === weekNum &&
      editingCell?.truckId === truck.id &&
      editingCell?.field === field

    return (
      <tr
        key={`${weekNum}-${truck.id}`}
        className="border-b transition-colors"
        draggable
        onDragStart={() => handleDragStart(truck.id)}
        onDragOver={(e) => handleDragOver(e, truck.id)}
        onDrop={handleDrop}
        style={{
          borderColor: 'var(--monday-border-light)',
          backgroundColor: 'var(--monday-bg-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)'
        }}
      >
        {/* Drag handle */}
        <td className="px-1 py-2.5 border-r cursor-grab active:cursor-grabbing" style={{ borderColor: 'var(--monday-border-light)', width: '20px' }}>
          <GripVertical className="h-3.5 w-3.5 text-gray-300" />
        </td>

        {/* Truck */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <div className="flex items-center gap-2" style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
            <Truck className="h-3.5 w-3.5 text-gray-400" />
            {truck.truck_number}
          </div>
        </td>

        {/* Ending Miles */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('odometer') ? (
            <input
              type="number"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.odometer || ''}
              onChange={(e) => handleCellChange('odometer', parseInt(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, truck.id, 'odometer')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.odometer ? Number(entry.odometer).toLocaleString() : '-'}
            </div>
          )}
        </td>

        {/* Weekly Miles (calculated) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
            {(() => {
              const currentMiles = entry?.odometer ? Number(entry.odometer) : null
              const prevMiles = getPreviousEndingMiles(sortedEntriesByTruck, selectedYear, weekNum, truck.id)
              if (currentMiles !== null && prevMiles !== null) {
                const weeklyMiles = currentMiles - prevMiles
                return weeklyMiles.toLocaleString()
              }
              return '-'
            })()}
          </div>
        </td>

        {/* Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('gallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.gallons || ''}
              onChange={(e) => handleCellChange('gallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, truck.id, 'gallons')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.gallons ? Number(entry.gallons).toFixed(1) : '-'}
            </div>
          )}
        </td>

        {/* Price/Gal */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('pricePerGallon') ? (
            <input
              type="number"
              step="0.001"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.pricePerGallon || ''}
              onChange={(e) => handleCellChange('pricePerGallon', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, truck.id, 'pricePerGallon')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.price_per_gallon ? `$${Number(entry.price_per_gallon).toFixed(3)}` : '-'}
            </div>
          )}
        </td>

        {/* Fuel Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('totalAmount') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.totalAmount || ''}
              onChange={(e) => handleCellChange('totalAmount', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, truck.id, 'totalAmount')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.total_amount ? formatCurrency(Number(entry.total_amount)) : '-'}
            </div>
          )}
        </td>

        {/* DEF Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('defPrice') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.defPrice || ''}
              onChange={(e) => handleCellChange('defPrice', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, truck.id, 'defPrice')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.def_price ? `$${Number(entry.def_price).toFixed(2)}` : '-'}
            </div>
          )}
        </td>

        {/* Total (Fuel Price + DEF Price) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)' }}>
            {(() => {
              const fuelPrice = Number(entry?.total_amount) || 0
              const defPrice = Number(entry?.def_price) || 0
              const total = fuelPrice + defPrice
              return total > 0 ? formatCurrency(total) : '-'
            })()}
          </div>
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
          {entry && (
            <button
              onClick={() => handleDeleteRow(weekNum, truck.id)}
              className="p-1 rounded"
              style={{ color: 'var(--monday-stuck)' }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  // Render Summary View
  const renderSummaryView = () => {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total Miles</div>
            <div className="text-2xl font-bold text-blue-600">{summaryTotals.totalMiles.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total Gallons</div>
            <div className="text-2xl font-bold text-purple-600">{summaryTotals.totalGallons.toFixed(1)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total DEF Price</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(summaryTotals.totalDefPrice)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total Fuel Price</div>
            <div className="text-2xl font-bold" style={{ color: '#1a5f2a' }}>{formatCurrency(summaryTotals.totalFuelPrice)}</div>
          </div>
        </div>

        {/* Truck Table */}
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-4 py-3 text-left border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Truck
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Total Miles
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Total Gallons
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  MPG
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Avg Price/Gal
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Total DEF Price
                </th>
                <th className="px-4 py-3 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 600, color: 'var(--monday-text-secondary)' }}>
                  Total Fuel Price
                </th>
              </tr>
            </thead>
            <tbody>
              {summaryByTruck.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No fuel data available
                  </td>
                </tr>
              ) : (
                <>
                  {summaryByTruck.map((truck) => (
                    <tr
                      key={truck.truck_id}
                      className="border-b transition-colors hover:bg-gray-50"
                      style={{ borderColor: 'var(--monday-border-light)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="font-medium" style={{ color: 'var(--monday-text-primary)' }}>
                            {truck.truck_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--monday-text-primary)' }}>
                        {truck.totalMiles > 0 ? truck.totalMiles.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--monday-text-primary)' }}>
                        {truck.totalGallons > 0 ? truck.totalGallons.toFixed(1) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--monday-text-primary)' }}>
                        {truck.totalMiles > 0 && truck.totalGallons > 0 ? (truck.totalMiles / truck.totalGallons).toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--monday-text-primary)' }}>
                        {truck.avgPricePerGallon > 0 ? `$${truck.avgPricePerGallon.toFixed(3)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--monday-text-primary)' }}>
                        {truck.totalDefPrice > 0 ? formatCurrency(truck.totalDefPrice) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: '#1a5f2a' }}>
                        {formatCurrency(truck.totalFuelPrice)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalMiles.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalGallons.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalMiles > 0 && summaryTotals.totalGallons > 0 ? (summaryTotals.totalMiles / summaryTotals.totalGallons).toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalGallons > 0 ? `$${(summaryTotals.totalFuelPrice / summaryTotals.totalGallons).toFixed(3)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                      {formatCurrency(summaryTotals.totalDefPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: '#1a5f2a' }}>
                      {formatCurrency(summaryTotals.totalFuelPrice)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Weekly View (existing view)
  const renderWeeklyView = () => {
    return (
      <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
              <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '20px' }}></th>
              <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Truck</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Ending Miles</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Weekly Miles</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Gallons</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Price/Gal</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Fuel Price</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>DEF Price</th>
              <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
              <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {allWeeks.map((weekNum) => {
              const isCollapsed = collapsedWeeks.has(weekNum)
              const activeTruckIds = new Set(activeTrucks.map(t => t.id))
              const weekEntries = fuelEntries.filter(e => e.weekNumber === weekNum && e.truck_id && activeTruckIds.has(e.truck_id))
              const weekFuelPrice = weekEntries.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0)
              const weekDefPrice = weekEntries.reduce((sum, e) => sum + (Number(e.def_price) || 0), 0)
              const weekTotal = weekFuelPrice + weekDefPrice
              const weekGallons = weekEntries.reduce((sum, e) => sum + (Number(e.gallons) || 0), 0)

              return (
                <React.Fragment key={weekNum}>
                  {/* Week Header */}
                  <tr
                    className="border-b cursor-pointer"
                    style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}
                    onClick={() => toggleWeek(weekNum)}
                  >
                    <td colSpan={2} className="px-2 py-2" style={{ paddingLeft: '8px' }}>
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--monday-blue)' }} />
                        ) : (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--monday-blue)' }} />
                        )}
                        <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-primary)' }}>
                          Week {weekNum} {getWeekDateRange(weekNum, selectedYear)}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                          ({weekEntries.length} entries)
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2" colSpan={6}></td>
                    <td className="px-2 py-2">
                      <div className="mb-0.5">
                        <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)' }}>
                          {formatCurrency(weekTotal)}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: 'var(--monday-blue)' }}>
                        {weekGallons.toFixed(1)} gal
                      </div>
                    </td>
                    <td className="px-2 py-2"></td>
                  </tr>

                  {/* Truck Rows */}
                  {!isCollapsed && activeTrucks
                    .map((truck, truckIndex) =>
                      renderFuelRow(weekNum, truck, truckIndex)
                    )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Layout>
      <div className="p-4 page-fuel">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--monday-text-primary)' }}>Fuel</h1>

        {/* Tabs: Summary + Years */}
        <div className="flex items-center gap-2 border-b mb-4" style={{ borderColor: 'var(--monday-border-light)' }}>
          {/* Summary Tab */}
          <button
            onClick={() => setActiveTab('summary')}
            className="px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2"
            style={{
              color: activeTab === 'summary' ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
              borderBottom: activeTab === 'summary' ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            <BarChart3 className="h-4 w-4" />
            Summary
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 mx-2"></div>

          {/* Year Tabs */}
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setActiveTab(year)}
              className="px-4 py-2 text-sm font-medium transition-all relative"
              style={{
                color: activeTab === year ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
                borderBottom: activeTab === year ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              {year}
              {year === new Date().getFullYear() && (
                <span className="ml-1 text-xs opacity-60">(Current)</span>
              )}
            </button>
          ))}
        </div>

        {/* Content based on active tab */}
        {activeTab === 'summary' ? renderSummaryView() : renderWeeklyView()}
      </div>
    </Layout>
  )
}
