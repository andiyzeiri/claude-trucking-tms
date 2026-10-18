'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, ChevronLeft, Truck, BarChart3, GripVertical, Plus, X, CreditCard, Ban } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useTrucks, useCreateTruck, useDeleteTruck, useUpdateTruck, isInService } from '@/hooks/use-trucks'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { useEldConnection, useEldMileage } from '@/hooks/use-eld'
import { formatCurrency } from '@/lib/utils'
import { Fuel } from '@/types'
import { useColumnWidths } from '@/hooks/use-column-widths'
import { ColumnWidthControl } from '@/components/ui/column-width-control'
import { FuelCardsView } from '@/components/fuel/fuel-cards-view'

type EditingCell = {
  weekNumber: number
  truckId: number
  field: string
} | null

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

// ISO weeks in a year: 53 when Dec 28 falls in week 53, else 52.
function weeksInYear(year: number): number {
  return getWeekNumber(new Date(year, 11, 28))
}

const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
// 'Week 42 · Oct 12 – Oct 18, 2026', as on Payroll.
function weekOptionLabel(weekNumber: number, year: number): string {
  const monday = getDateFromWeekNumber(weekNumber, year)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `Week ${weekNumber} · ${fmtShort(monday)} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// Extended fuel entry with week info for local state
interface FuelEntryWithWeek extends Fuel {
  weekNumber: number
}

// Tab type - 'summary', 'cards' (WEX cards) or a year number
type TabType = 'summary' | 'cards' | number

export default function FuelPage() {
  const { data: trucksData, isLoading: trucksLoading } = useTrucks()
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const createFuel = useCreateFuel()
  const updateFuel = useUpdateFuel()
  const deleteFuel = useDeleteFuel()
  const createTruck = useCreateTruck()
  const deleteTruck = useDeleteTruck()
  const updateTruck = useUpdateTruck()
  const { columnWidths, adjustWidth } = useColumnWidths('fuel-table', {
    drag: 20,
    truck: 120,
    weeklyMiles: 100,
    gallons: 90,
    pricePerGal: 90,
    fuelPrice: 100,
    defPrice: 90,
    total: 100,
    mpg: 80,
    pricePerMile: 90,
  })

  const trucks = trucksData?.items || []
  const activeTrucksUnordered = trucks.filter(t => t.type === 'truck')

  // Truck ordering - persisted in localStorage
  const [truckOrder, setTruckOrder] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('fuel-truck-order')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  // Saved drag order, with trucks whose owner uses their own fuel card always last
  const activeTrucks = useMemo(() => {
    const orderMap = new Map(truckOrder.map((id, idx) => [id, idx]))
    return [...activeTrucksUnordered].sort((a, b) => {
      const ownCard = Number(!!a.own_fuel_card) - Number(!!b.own_fuel_card)
      if (ownCard !== 0) return ownCard
      const aIdx = orderMap.get(a.id) ?? 999999
      const bIdx = orderMap.get(b.id) ?? 999999
      return aIdx - bIdx
    })
  }, [activeTrucksUnordered, truckOrder])
  const ownCardTruckIds = useMemo(() => new Set(activeTrucks.filter(t => t.own_fuel_card).map(t => t.id)), [activeTrucks])

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

  // Add/delete truck state
  const [showAddTruck, setShowAddTruck] = useState(false)
  const [newTruckNumber, setNewTruckNumber] = useState('')

  const handleAddTruck = async () => {
    const trimmed = newTruckNumber.trim()
    if (!trimmed) return
    await createTruck.mutateAsync({
      truck_number: trimmed,
      status: 'available',
    })
    setNewTruckNumber('')
    setShowAddTruck(false)
  }

  const handleToggleOwnCard = (truck: any) => {
    updateTruck.mutate({ id: truck.id, data: { own_fuel_card: !truck.own_fuel_card } as any })
  }

  const handleDeleteTruck = async (truckId: number, truckNumber: string) => {
    if (confirm(`Delete truck ${truckNumber}? This will remove it from all fuel entries.`)) {
      await deleteTruck.mutateAsync(truckId)
    }
  }

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const thisIsoYear = getISOWeekYear(new Date())
  const thisWeek = getWeekNumber(new Date())
  const [activeTab, setActiveTab] = useState<TabType>(thisIsoYear)
  // One week at a time, picked from the dropdown (as on Payroll).
  const [selectedWeek, setSelectedWeek] = useState<number>(thisWeek)
  // Trucks whose individual fills are listed (several fuel entries in the week).
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [theoreticalMpg, setTheoreticalMpg] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fuel-theoretical-mpg')
      return saved ? parseFloat(saved) : 0
    } catch { return 0 }
  })

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
    years.add(getISOWeekYear(new Date()))
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
    if (typeof activeTab !== 'number') return []
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
      .sort((a, b) => Number(ownCardTruckIds.has(a.truck_id)) - Number(ownCardTruckIds.has(b.truck_id)) || a.truck_number.localeCompare(b.truck_number))
  }, [fuelEntriesWithYear, trucks, ownCardTruckIds])

  // Calculate grand totals for summary
  const summaryTotals = useMemo(() => {
    return summaryByTruck.reduce((acc, truck) => ({
      totalMiles: acc.totalMiles + truck.totalMiles,
      totalGallons: acc.totalGallons + truck.totalGallons,
      totalFuelPrice: acc.totalFuelPrice + truck.totalFuelPrice,
      totalDefPrice: acc.totalDefPrice + truck.totalDefPrice,
    }), { totalMiles: 0, totalGallons: 0, totalFuelPrice: 0, totalDefPrice: 0 })
  }, [summaryByTruck])

  // Every ISO week of the selected year (52 or 53)
  const allWeeks = useMemo(() => {
    const weeks = []
    for (let i = 1; i <= weeksInYear(selectedYear); i++) {
      weeks.push(i)
    }
    return weeks
  }, [selectedYear])

  // Weekly Miles: what each truck drove in the selected week from Peak ELD -
  // the same numbers as Payroll's Total Miles (Peak trucks are matched to TMS
  // trucks under Settings > ELD Integration).
  const { data: eldConnection } = useEldConnection()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const weekStart = getDateFromWeekNumber(selectedWeek, selectedYear)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const { data: eldMileage, isLoading: eldLoading } = useEldMileage(
    ymd(weekStart), ymd(weekEnd), !!eldConnection?.connected && typeof activeTab === 'number', true,
  )
  const eldMilesByTruck = useMemo(() => {
    const m = new Map<number, { miles: number; how: string }>()
    eldMileage?.vehicles.forEach(v => {
      if (!v.truck_id) return
      const odo = v.odometer_miles != null
      m.set(v.truck_id, {
        miles: odo ? v.odometer_miles! : v.miles,
        how: odo
          ? `Odometer ${v.start_odometer?.toLocaleString()} → ${v.end_odometer?.toLocaleString()} (${v.odometer_source === 'eld' ? 'live ELD odometer' : 'first and last inspection of the week'}), Peak unit ${v.unit}`
          : `GPS miles from Peak unit ${v.unit}`,
      })
    })
    return m
  }, [eldMileage])

  // Changing year lands on this week (current year) or week 1, as on Payroll.
  useEffect(() => {
    if (typeof activeTab === 'number') setSelectedWeek(activeTab === thisIsoYear ? thisWeek : 1)
    setExpanded(new Set())
  }, [activeTab, thisIsoYear, thisWeek])

  // Every fuel entry per week and truck, oldest first. A truck can have
  // several in a week (one per card swipe from the WEX import).
  const entriesByWeekAndTruck = useMemo(() => {
    const grouped: Record<number, Record<number, FuelEntryWithWeek[]>> = {}
    fuelEntries.forEach(entry => {
      if (!entry.truck_id) return
      const week = grouped[entry.weekNumber] || (grouped[entry.weekNumber] = {})
      const list = week[entry.truck_id] || (week[entry.truck_id] = [])
      list.push(entry)
    })
    Object.values(grouped).forEach(week => Object.values(week).forEach(list =>
      list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)))
    return grouped
  }, [fuelEntries])

  // One row per truck per week: the entry itself, or the week's entries added
  // up (ending miles = the highest odometer) when there are several.
  const fuelByWeekAndTruck = useMemo(() => {
    const grouped: Record<number, Record<number, FuelEntryWithWeek | null>> = {}
    Object.entries(entriesByWeekAndTruck).forEach(([week, byTruck]) => {
      const out: Record<number, FuelEntryWithWeek | null> = {}
      Object.entries(byTruck).forEach(([truckId, list]) => {
        if (list.length === 1) { out[Number(truckId)] = list[0]; return }
        const sum = (f: (e: FuelEntryWithWeek) => any) => list.reduce((t, e) => t + (Number(f(e)) || 0), 0)
        const odometers = list.map(e => Number(e.odometer) || 0).filter(n => n > 0)
        out[Number(truckId)] = {
          ...list[list.length - 1],
          gallons: sum(e => e.gallons),
          total_amount: sum(e => e.total_amount),
          def_gallons: sum(e => e.def_gallons),
          def_price: sum(e => e.def_price),
          odometer: odometers.length ? Math.max(...odometers) : undefined,
        }
      })
      grouped[Number(week)] = out
    })
    return grouped
  }, [entriesByWeekAndTruck])

  const fillCount = (weekNumber: number, truckId: number) => entriesByWeekAndTruck[weekNumber]?.[truckId]?.length || 0

  const toggleExpanded = (truckId: number) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(truckId)) next.delete(truckId)
    else next.add(truckId)
    return next
  })

  const handleCellClick = (weekNumber: number, truckId: number, field: string) => {
    // A week with several fills is added up here; its fills are listed below the row.
    if (fillCount(weekNumber, truckId) > 1) {
      setExpanded(prev => new Set(prev).add(truckId))
      return
    }
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
      editValues.defPrice > 0

    if (hasData) {
      // Convert week number to date (Monday of that week)
      const weekDate = getDateFromWeekNumber(weekNumber, selectedYear)
      const dateStr = weekDate.toISOString().split('T')[0]

      // Build fuel data - use null checks instead of || to preserve zero values
      const gallons = editValues.gallons ?? 0
      const totalAmount = editValues.totalAmount ?? 0
      const calculatedPpg = gallons > 0 && totalAmount > 0 ? parseFloat((totalAmount / gallons).toFixed(3)) : undefined
      const fuelData = {
        date: dateStr,
        gallons,
        price_per_gallon: calculatedPpg,
        def_gallons: editValues.defGallons != null && editValues.defGallons !== 0 ? editValues.defGallons : undefined,
        def_price: editValues.defPrice != null && editValues.defPrice !== 0 ? editValues.defPrice : undefined,
        total_amount: totalAmount,
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

  const handleDeleteEntry = async (entry: Fuel) => {
    if (confirm(`Delete the ${entry.date} fuel entry (${formatCurrency(Number(entry.total_amount) || 0)})?`)) {
      try {
        await deleteFuel.mutateAsync(entry.id)
      } catch (error) {
        console.error('Failed to delete fuel entry:', error)
      }
    }
  }

  const handleDeleteRow = async (weekNumber: number, truckId: number) => {
    if (fillCount(weekNumber, truckId) > 1) return  // delete single fills from the list
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
    const eld = eldMilesByTruck.get(truck.id)
    const weeklyMiles = eld?.miles || 0

    const ownCard = !!truck.own_fuel_card
    const rowBg = ownCard ? 'rgba(220, 38, 38, 0.10)' : 'var(--monday-bg-primary)'

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
        onContextMenu={(e) => {
          if (entry) {
            e.preventDefault()
            handleDeleteRow(weekNum, truck.id)
          }
        }}
        style={{
          borderColor: 'var(--monday-border-light)',
          backgroundColor: rowBg,
          color: ownCard ? '#dc2626' : undefined
        }}
        title={ownCard ? 'Owner uses their own fuel card (not in the totals)' : undefined}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = ownCard ? 'rgba(220, 38, 38, 0.16)' : 'var(--monday-bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = rowBg
        }}
      >
        {/* Drag handle */}
        <td className="px-1 py-2.5 border-r cursor-grab active:cursor-grabbing" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.drag}px`, minWidth: `${columnWidths.drag}px` }}>
          <GripVertical className="h-3.5 w-3.5 text-gray-500" />
        </td>

        {/* Truck */}
        <td className="px-3 py-2.5 border-r group/truck" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.truck}px`, minWidth: `${columnWidths.truck}px` }}>
          <div className="flex items-center gap-2" style={{ fontSize: '13px', lineHeight: '18px', color: ownCard ? '#dc2626' : 'var(--monday-text-primary)', fontWeight: ownCard ? 600 : undefined }}>
            <Truck className="h-3.5 w-3.5" style={{ color: ownCard ? '#dc2626' : 'var(--monday-text-muted)' }} />
            {truck.truck_number}
            {ownCard && <span style={{ fontSize: '10px', fontWeight: 600 }}>OWN CARD</span>}
            {fillCount(weekNum, truck.id) > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(truck.id) }}
                className="flex items-center gap-0.5 rounded px-1 hover:bg-gray-100"
                style={{ fontSize: '11px', color: 'var(--monday-blue)' }}
                title="Fuel entries this week"
              >
                {expanded.has(truck.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {fillCount(weekNum, truck.id)} fills
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleOwnCard(truck) }}
              disabled={updateTruck.isPending}
              className="p-0.5 rounded hover:bg-red-50 opacity-0 group-hover/truck:opacity-100 transition-opacity ml-auto"
              style={{ color: ownCard ? 'var(--monday-done)' : '#dc2626' }}
              title={ownCard ? 'Back to company fuel card' : 'Owner uses their own fuel card (red it out, move to bottom)'}
            >
              {ownCard ? <CreditCard className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteTruck(truck.id, truck.truck_number) }}
              className="p-0.5 rounded hover:bg-red-50 opacity-0 group-hover/truck:opacity-100 transition-opacity"
              style={{ color: 'var(--monday-stuck)' }}
              title="Delete truck"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </td>

        {/* Weekly Miles (Peak ELD, as on Payroll) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.weeklyMiles}px`, minWidth: `${columnWidths.weeklyMiles}px` }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }} title={eld?.how || (eldConnection?.connected ? 'No Peak ELD miles for this truck this week (match Peak trucks under Settings > ELD Integration)' : 'Connect Peak ELD to see miles')}>
            {weeklyMiles > 0 ? weeklyMiles.toLocaleString() : '-'}
          </div>
        </td>

        {/* Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.gallons}px`, minWidth: `${columnWidths.gallons}px` }}>
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

        {/* MPG (calculated: weekly miles / gallons) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.mpg}px`, minWidth: `${columnWidths.mpg}px` }}>
          <div
            className="rounded px-1.5 py-0.5"
            style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-secondary)' }}
          >
            {(() => {
              const gallons = Number(entry?.gallons) || 0
              return weeklyMiles > 0 && gallons > 0 ? (weeklyMiles / gallons).toFixed(2) : '-'
            })()}
          </div>
        </td>

        {/* Fuel Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.fuelPrice}px`, minWidth: `${columnWidths.fuelPrice}px` }}>
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

        {/* Price/Gal (calculated: fuel price / gallons) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.pricePerGal}px`, minWidth: `${columnWidths.pricePerGal}px` }}>
          <div
            className="rounded px-1.5 py-0.5"
            style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-secondary)' }}
          >
            {(() => {
              const gallons = Number(entry?.gallons) || 0
              const fuelPrice = Number(entry?.total_amount) || 0
              if (gallons > 0 && fuelPrice > 0) {
                return `$${(fuelPrice / gallons).toFixed(3)}`
              }
              return '-'
            })()}
          </div>
        </td>

        {/* DEF Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.defPrice}px`, minWidth: `${columnWidths.defPrice}px` }}>
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

        {/* Price/Mile (calculated: total / weekly miles) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.pricePerMile}px`, minWidth: `${columnWidths.pricePerMile}px` }}>
          <div
            className="rounded px-1.5 py-0.5"
            style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-secondary)' }}
          >
            {(() => {
              const fuelPrice = Number(entry?.total_amount) || 0
              const defPrice = Number(entry?.def_price) || 0
              const total = fuelPrice + defPrice
              return weeklyMiles > 0 && total > 0 ? `$${(total / weeklyMiles).toFixed(3)}` : '-'
            })()}
          </div>
        </td>

        {/* Total (Fuel Price + DEF Price) */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.total}px`, minWidth: `${columnWidths.total}px` }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)' }}>
            {(() => {
              const fuelPrice = Number(entry?.total_amount) || 0
              const defPrice = Number(entry?.def_price) || 0
              const total = fuelPrice + defPrice
              return total > 0 ? formatCurrency(total) : '-'
            })()}
          </div>
        </td>

      </tr>
    )
  }

  // Render Summary View
  const renderSummaryView = () => {
    const grandTotal = summaryTotals.totalFuelPrice + summaryTotals.totalDefPrice

    // Only include trucks that have both miles AND gallons for MPG average
    const mpgTrucks = summaryByTruck.filter(t => t.totalMiles > 0 && t.totalGallons > 0)
    const mpgMiles = mpgTrucks.reduce((s, t) => s + t.totalMiles, 0)
    const mpgGallons = mpgTrucks.reduce((s, t) => s + t.totalGallons, 0)
    const grandMpg = mpgGallons > 0 ? (mpgMiles / mpgGallons).toFixed(2) : '-'

    // Only include trucks that have gallons AND fuel price for Price/Gal average
    const ppgTrucks = summaryByTruck.filter(t => t.totalGallons > 0 && t.totalFuelPrice > 0)
    const ppgFuel = ppgTrucks.reduce((s, t) => s + t.totalFuelPrice, 0)
    const ppgGallons = ppgTrucks.reduce((s, t) => s + t.totalGallons, 0)
    const grandPpg = ppgGallons > 0 ? `$${(ppgFuel / ppgGallons).toFixed(3)}` : '-'

    // Only include trucks that have miles AND a total cost for Price/Mile average
    const ppmTrucks = summaryByTruck.filter(t => t.totalMiles > 0 && (t.totalFuelPrice + t.totalDefPrice) > 0)
    const ppmTotal = ppmTrucks.reduce((s, t) => s + t.totalFuelPrice + t.totalDefPrice, 0)
    const ppmMiles = ppmTrucks.reduce((s, t) => s + t.totalMiles, 0)
    const grandPpm = ppmMiles > 0 ? `$${(ppmTotal / ppmMiles).toFixed(3)}` : '-'

    return (
      <div className="space-y-4">
        {/* Summary Totals Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-0.5">Total Miles</div>
            <div className="text-lg font-bold text-brand">{summaryTotals.totalMiles.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-0.5">Total Gallons</div>
            <div className="text-lg font-bold text-purple-600">{summaryTotals.totalGallons.toFixed(1)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-0.5">Avg MPG</div>
            <div className="text-lg font-bold text-cyan-600">{grandMpg}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-0.5">Avg Price/Mile</div>
            <div className="text-lg font-bold text-amber-600">{grandPpm}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-0.5">Total</div>
            <div className="text-lg font-bold" style={{ color: 'var(--monday-done)' }}>{formatCurrency(grandTotal)}</div>
          </div>
        </div>

        {/* Theoretical MPG */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-700">Theoretical MPG</div>
            <input
              type="number"
              step="0.1"
              className="w-24 px-2 py-1.5 border rounded text-sm text-right font-semibold"
              style={{ borderColor: 'var(--monday-border)' }}
              value={theoreticalMpg || ''}
              placeholder="0"
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                setTheoreticalMpg(val)
                localStorage.setItem('fuel-theoretical-mpg', String(val))
              }}
            />
          </div>
        </div>

        {/* Truck Table - matching weekly view column order */}
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.truck}px`, minWidth: `${columnWidths.truck}px` }}>
                  Truck
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.weeklyMiles}px`, minWidth: `${columnWidths.weeklyMiles}px` }}>
                  Total Miles
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.gallons}px`, minWidth: `${columnWidths.gallons}px` }}>
                  Gallons
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.mpg}px`, minWidth: `${columnWidths.mpg}px` }}>
                  MPG
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.fuelPrice}px`, minWidth: `${columnWidths.fuelPrice}px` }}>
                  Fuel Price
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.pricePerGal}px`, minWidth: `${columnWidths.pricePerGal}px` }}>
                  Price/Gal
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.defPrice}px`, minWidth: `${columnWidths.defPrice}px` }}>
                  DEF Price
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.pricePerMile}px`, minWidth: `${columnWidths.pricePerMile}px` }}>
                  Price/Mile
                </th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths.total}px`, minWidth: `${columnWidths.total}px` }}>
                  Total
                </th>
                {theoreticalMpg > 0 && (
                  <th className="px-3 py-2.5 text-right border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '120px', minWidth: '120px' }}>
                    Theo. Diff
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {summaryByTruck.length === 0 ? (
                <tr>
                  <td colSpan={theoreticalMpg > 0 ? 10 : 9} className="px-4 py-8 text-center text-gray-500">
                    No fuel data available
                  </td>
                </tr>
              ) : (
                <>
                  {summaryByTruck.map((truck) => {
                    const truckTotal = truck.totalFuelPrice + truck.totalDefPrice
                    const truckMpg = truck.totalMiles > 0 && truck.totalGallons > 0 ? (truck.totalMiles / truck.totalGallons).toFixed(2) : '-'
                    const truckPpm = truck.totalMiles > 0 && truckTotal > 0 ? `$${(truckTotal / truck.totalMiles).toFixed(3)}` : '-'
                    return (
                      <tr
                        key={truck.truck_id}
                        className="border-b transition-colors"
                        style={{ borderColor: 'var(--monday-border-light)', backgroundColor: ownCardTruckIds.has(truck.truck_id) ? 'rgba(220, 38, 38, 0.10)' : 'var(--monday-bg-primary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ownCardTruckIds.has(truck.truck_id) ? 'rgba(220, 38, 38, 0.10)' : 'var(--monday-bg-primary)' }}
                      >
                        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
                          <div className="flex items-center gap-2" style={{ fontSize: '13px', lineHeight: '18px', color: ownCardTruckIds.has(truck.truck_id) ? '#dc2626' : 'var(--monday-text-primary)' }}>
                            <Truck className="h-3.5 w-3.5 text-gray-500" />
                            {truck.truck_number}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                          {truck.totalMiles > 0 ? truck.totalMiles.toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                          {truck.totalGallons > 0 ? truck.totalGallons.toFixed(1) : '-'}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                          {truckMpg}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                          {truck.totalFuelPrice > 0 ? formatCurrency(truck.totalFuelPrice) : '-'}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                          {truck.avgPricePerGallon > 0 ? `$${truck.avgPricePerGallon.toFixed(3)}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                          {truck.totalDefPrice > 0 ? formatCurrency(truck.totalDefPrice) : '-'}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                          {truckPpm}
                        </td>
                        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-done)' }}>
                          {truckTotal > 0 ? formatCurrency(truckTotal) : '-'}
                        </td>
                        {theoreticalMpg > 0 && (
                          <td className="px-3 py-2.5 text-right" style={{ fontSize: '13px', fontWeight: 600 }}>
                            {(() => {
                              if (truck.totalMiles <= 0 || truck.avgPricePerGallon <= 0) return '-'
                              const theoGallons = truck.totalMiles / theoreticalMpg
                              const theoFuel = theoGallons * truck.avgPricePerGallon
                              const theoTotal = theoFuel + truck.totalDefPrice
                              const diff = theoTotal - truckTotal
                              return <span style={{ color: diff >= 0 ? '#16a34a' : '#dc2626' }}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>
                            })()}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {/* Totals Row */}
                  <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                    <td className="px-3 py-2.5 border-r font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      Total
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalMiles.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {summaryTotals.totalGallons.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                      {grandMpg}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {formatCurrency(summaryTotals.totalFuelPrice)}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                      {grandPpg}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
                      {formatCurrency(summaryTotals.totalDefPrice)}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-secondary)' }}>
                      {grandPpm}
                    </td>
                    <td className="px-3 py-2.5 border-r text-right font-bold" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 700, color: 'var(--monday-done)' }}>
                      {formatCurrency(grandTotal)}
                    </td>
                    {theoreticalMpg > 0 && (
                      <td className="px-3 py-2.5 text-right font-bold" style={{ fontSize: '13px', fontWeight: 700 }}>
                        {(() => {
                          const theoGrandTotal = summaryByTruck.reduce((sum, truck) => {
                            if (truck.totalMiles <= 0 || truck.avgPricePerGallon <= 0) return sum
                            const theoGallons = truck.totalMiles / theoreticalMpg
                            const theoFuel = theoGallons * truck.avgPricePerGallon
                            return sum + theoFuel + truck.totalDefPrice
                          }, 0)
                          if (theoGrandTotal <= 0) return '-'
                          const diff = theoGrandTotal - grandTotal
                          return <span style={{ color: diff >= 0 ? '#16a34a' : '#dc2626' }}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>
                        })()}
                      </td>
                    )}
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
  // Totals for a set of weeks, over the trucks on the page.
  const totalsFor = (weeks: number[]) => {
    // Own-card trucks are left out: their miles have no fuel against them here
    const activeTruckIds = new Set(activeTrucks.filter(t => !t.own_fuel_card).map(t => t.id))
    const set = new Set(weeks)
    const entries = fuelEntries.filter(e => set.has(e.weekNumber) && e.truck_id && activeTruckIds.has(e.truck_id))
    const fuel = entries.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0)
    const def = entries.reduce((sum, e) => sum + (Number(e.def_price) || 0), 0)
    const gallons = entries.reduce((sum, e) => sum + (Number(e.gallons) || 0), 0)
    // Miles only for the selected week (Peak ELD is read one week at a time).
    const miles = weeks.length === 1 && weeks[0] === selectedWeek
      ? activeTrucks.filter(t => !t.own_fuel_card).reduce((sum, t) => sum + (eldMilesByTruck.get(t.id)?.miles || 0), 0)
      : 0
    return { fuel, def, total: fuel + def, gallons, miles, fills: entries.length, weeks: weeks.length }
  }

  const renderStats = (title: string, subtitle: string, t: ReturnType<typeof totalsFor>) => {
    const tiles = [
      { label: 'Total', value: formatCurrency(t.total), sub: `Fuel ${formatCurrency(t.fuel)} · DEF ${formatCurrency(t.def)}`, color: 'var(--monday-done)' },
      { label: 'Gallons', value: t.gallons.toLocaleString('en-US', { maximumFractionDigits: 1 }), sub: `${t.fills} fuel ${t.fills === 1 ? 'entry' : 'entries'}` },
      { label: 'Avg Price/Gal', value: t.gallons > 0 ? `$${(t.fuel / t.gallons).toFixed(3)}` : '-', sub: 'Fuel only' },
      t.weeks === 1
        ? { label: 'Miles (ELD)', value: eldLoading && eldConnection?.connected ? '…' : t.miles.toLocaleString(), sub: t.miles > 0 ? `$${(t.total / t.miles).toFixed(3)}/mi · ${t.gallons > 0 ? (t.miles / t.gallons).toFixed(2) : '-'} MPG` : (eldConnection?.connected ? 'Same as Payroll Total Miles' : 'Connect Peak ELD for miles') }
        : { label: 'Avg per week', value: formatCurrency(t.weeks ? t.total / t.weeks : 0), sub: `Over ${t.weeks} week${t.weeks === 1 ? '' : 's'}` },
    ]
    return (
      <div className="rounded-lg shadow-sm p-4" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
        <div className="flex items-baseline gap-2 mb-3">
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{title}</span>
          <span style={{ fontSize: '13px', color: 'var(--monday-text-secondary)' }}>{subtitle}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(tile => (
            <div key={tile.label} className="rounded-md p-3" style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--monday-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tile.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: tile.color || 'var(--monday-text-primary)', marginTop: '2px' }}>{tile.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--monday-text-muted)', marginTop: '4px' }}>{tile.sub}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // The fills behind a truck's week total, one line each.
  const renderFillRows = (weekNum: number, truck: any) => {
    const list = entriesByWeekAndTruck[weekNum]?.[truck.id] || []
    const muted = { fontSize: '12px', lineHeight: '16px', color: 'var(--monday-text-secondary)' }
    return list.map(e => {
      const day = new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
      const gallons = Number(e.gallons) || 0
      const fuel = Number(e.total_amount) || 0
      const def = Number(e.def_price) || 0
      return (
        <tr key={`fill-${e.id}`} className="border-b" style={{ borderColor: 'var(--monday-border-light)', backgroundColor: 'var(--monday-bg-secondary)' }}>
          <td className="border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
          <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>
            <span style={{ paddingLeft: '20px' }}>{day}</span>
          </td>
          <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', ...muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.location || ''}>
            {e.location || ''}
          </td>
          <td className="px-3 py-1.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>{gallons ? gallons.toFixed(1) : '-'}</td>
          <td className="border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
          <td className="px-3 py-1.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>{fuel ? formatCurrency(fuel) : '-'}</td>
          <td className="px-3 py-1.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>{gallons > 0 && fuel > 0 ? `$${(fuel / gallons).toFixed(3)}` : '-'}</td>
          <td className="px-3 py-1.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>{def ? `$${def.toFixed(2)}` : '-'}</td>
          <td className="px-3 py-1.5 border-r" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>{(e.notes || '').startsWith('WEX') ? 'WEX card' : 'Entered'}</td>
          <td className="px-3 py-1.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', ...muted }}>
            <div className="flex items-center justify-end gap-1">
              {formatCurrency(fuel + def)}
              <button onClick={() => handleDeleteEntry(e)} className="p-0.5 rounded hover:bg-red-50" style={{ color: 'var(--monday-stuck)' }} title="Delete this fuel entry">
                <X className="h-3 w-3" />
              </button>
            </div>
          </td>
        </tr>
      )
    })
  }

  const renderWeeklyView = () => {
    const week = totalsFor([selectedWeek])
    // Sold / not-leased trucks only in weeks they have fuel in (history stays visible)
    const weekTrucks = activeTrucks.filter(t => isInService(t) || fillCount(selectedWeek, t.id) > 0)
    const isCurrentYear = selectedYear === thisIsoYear
    const yearWeeks = isCurrentYear ? allWeeks.filter(w => w <= thisWeek) : allWeeks
    const th = (key: string, label: string, align: 'left' | 'right' = 'right') => (
      <th className={`px-3 py-2.5 text-${align} border-b border-r relative group`} style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: `${columnWidths[key]}px`, minWidth: `${columnWidths[key]}px`, backgroundColor: 'var(--monday-bg-secondary)' }}>
        {label}
        <ColumnWidthControl currentWidth={columnWidths[key]} onAdjust={(delta) => adjustWidth(key, delta)} />
      </th>
    )
    const footCell = (content: React.ReactNode) => (
      <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>{content}</td>
    )
    return (
      <div className="space-y-4">
        {/* Week picker */}
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Week</span>
          <Button variant="outline" size="sm" aria-label="Previous week" disabled={selectedWeek <= 1} onClick={() => { setSelectedWeek(w => Math.max(1, w - 1)); setExpanded(new Set()) }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(selectedWeek)} onValueChange={(v) => { setSelectedWeek(Number(v)); setExpanded(new Set()) }}>
            <SelectTrigger className="w-[300px]" style={{ fontSize: '14px', fontWeight: 500 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[360px]">
              {allWeeks.map(w => (
                <SelectItem key={w} value={String(w)}>
                  {weekOptionLabel(w, selectedYear)}
                  {isCurrentYear && w === thisWeek ? ' (this week)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" aria-label="Next week" disabled={selectedWeek >= allWeeks.length} onClick={() => { setSelectedWeek(w => Math.min(allWeeks.length, w + 1)); setExpanded(new Set()) }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week + year stats */}
        <div className="grid gap-4 lg:grid-cols-2">
          {renderStats(`Week ${selectedWeek}`, weekOptionLabel(selectedWeek, selectedYear).split(' · ')[1], week)}
          {renderStats(`${selectedYear}`, isCurrentYear ? 'Year to date' : 'Full year', totalsFor(yearWeeks))}
        </div>

        {/* The week's fuel, one row per truck */}
        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', width: `${columnWidths.drag}px`, minWidth: `${columnWidths.drag}px`, backgroundColor: 'var(--monday-bg-secondary)' }}></th>
                {th('truck', 'Truck', 'left')}
                {th('weeklyMiles', 'Weekly Miles')}
                {th('gallons', 'Gallons')}
                {th('mpg', 'MPG')}
                {th('fuelPrice', 'Fuel Price')}
                {th('pricePerGal', 'Price/Gal')}
                {th('defPrice', 'DEF Price')}
                {th('pricePerMile', 'Price/Mile')}
                {th('total', 'Total')}
              </tr>
            </thead>
            <tbody>
              {weekTrucks.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                    No trucks yet. Add one with Add Truck.
                  </td>
                </tr>
              )}
              {weekTrucks.map((truck, truckIndex) => (
                <React.Fragment key={truck.id}>
                  {renderFuelRow(selectedWeek, truck, truckIndex)}
                  {expanded.has(truck.id) && fillCount(selectedWeek, truck.id) > 1 && renderFillRows(selectedWeek, truck)}
                </React.Fragment>
              ))}
            </tbody>
            {weekTrucks.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                  <td className="border-r" style={{ borderColor: 'var(--monday-border-light)' }}></td>
                  <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', fontWeight: 600, color: 'var(--monday-text-primary)' }}>Week {selectedWeek} total</td>
                  {footCell(week.miles ? week.miles.toLocaleString() : '-')}
                  {footCell(week.gallons ? week.gallons.toFixed(1) : '-')}
                  {footCell(week.miles && week.gallons ? (week.miles / week.gallons).toFixed(2) : '-')}
                  {footCell(week.fuel ? formatCurrency(week.fuel) : '-')}
                  {footCell(week.gallons && week.fuel ? `$${(week.fuel / week.gallons).toFixed(3)}` : '-')}
                  {footCell(week.def ? formatCurrency(week.def) : '-')}
                  {footCell(week.miles ? `$${(week.total / week.miles).toFixed(3)}` : '-')}
                  <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '14px', fontWeight: 600, color: 'var(--monday-done)' }}>{formatCurrency(week.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="p-4 page-fuel">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Fuel</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              style={{ fontSize: '13px', fontWeight: 500 }}
              onClick={() => { if (activeTab !== thisIsoYear) setActiveTab(thisIsoYear); else setSelectedWeek(thisWeek); setExpanded(new Set()) }}
            >
              Current Week
            </Button>
            {showAddTruck ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Truck number"
                  className="border rounded px-3 py-1.5 text-sm"
                  style={{ borderColor: 'var(--monday-border)', width: '140px' }}
                  value={newTruckNumber}
                  onChange={(e) => setNewTruckNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTruck()
                    if (e.key === 'Escape') { setShowAddTruck(false); setNewTruckNumber('') }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleAddTruck}
                  disabled={!newTruckNumber.trim() || createTruck.isPending}
                  className="px-3 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--monday-done)' }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddTruck(false); setNewTruckNumber('') }}
                  className="p-1.5 rounded hover:bg-gray-100"
                  style={{ color: 'var(--monday-text-secondary)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTruck(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--monday-blue)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Truck
              </button>
            )}
          </div>
        </div>

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

          {/* Cards Tab: WEX cards, their trucks and transactions */}
          <button
            onClick={() => setActiveTab('cards')}
            className="px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2"
            style={{
              color: activeTab === 'cards' ? 'var(--monday-cornflower)' : 'var(--monday-text-secondary)',
              borderBottom: activeTab === 'cards' ? '2px solid var(--monday-cornflower)' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            <CreditCard className="h-4 w-4" />
            Cards
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
        {activeTab === 'summary' ? renderSummaryView()
          : activeTab === 'cards' ? <FuelCardsView trucks={activeTrucks} />
          : renderWeeklyView()}
      </div>
    </Layout>
  )
}
