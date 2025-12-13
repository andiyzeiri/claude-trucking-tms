'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { Fuel } from '@/types'

type EditingCell = {
  weekNumber: number
  driverId: number
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

export default function FuelPage() {
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: trucksData } = useTrucks()
  const { data: fuelData, isLoading: fuelLoading } = useFuel()
  const createFuel = useCreateFuel()
  const updateFuel = useUpdateFuel()
  const deleteFuel = useDeleteFuel()

  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())
  const hasInitiallyCollapsed = useRef(false)

  const currentYear = new Date().getFullYear()

  // Convert API fuel entries to include week numbers
  const fuelEntries: FuelEntryWithWeek[] = useMemo(() => {
    if (!fuelData) return []
    return fuelData.map(entry => ({
      ...entry,
      weekNumber: getWeekNumber(new Date(entry.date))
    }))
  }, [fuelData])

  // Generate all 52 weeks
  const allWeeks = useMemo(() => {
    const weeks = []
    for (let i = 1; i <= 52; i++) {
      weeks.push(i)
    }
    return weeks
  }, [])

  // Group fuel entries by week and driver
  const fuelByWeekAndDriver = useMemo(() => {
    const grouped: Record<number, Record<number, FuelEntryWithWeek | null>> = {}

    allWeeks.forEach(weekNum => {
      grouped[weekNum] = {}
      drivers.forEach(driver => {
        grouped[weekNum][driver.id] = null
      })
    })

    fuelEntries.forEach(entry => {
      if (grouped[entry.weekNumber] && entry.driver_id) {
        grouped[entry.weekNumber][entry.driver_id] = entry
      }
    })

    return grouped
  }, [fuelEntries, drivers, allWeeks])

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

  const handleCellClick = (weekNumber: number, driverId: number, field: string) => {
    const existing = fuelByWeekAndDriver[weekNumber]?.[driverId]
    setEditingCell({ weekNumber, driverId, field })
    if (existing) {
      setEditValues({
        id: existing.id,
        weekNumber,
        driverId,
        truckId: existing.truck_id || null,
        gallons: existing.gallons || 0,
        pricePerGallon: existing.price_per_gallon || 0,
        defGallons: existing.def_gallons || 0,
        defPrice: existing.def_price || 0,
        totalAmount: existing.total_amount || 0,
      })
    } else {
      setEditValues({
        weekNumber,
        driverId,
        truckId: null,
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

    const { weekNumber, driverId } = editingCell
    const existing = fuelByWeekAndDriver[weekNumber]?.[driverId]

    // Check if there's any meaningful data
    const hasData = editValues.gallons > 0 || editValues.totalAmount > 0 || editValues.defGallons > 0

    if (hasData) {
      // Convert week number to date (Monday of that week)
      const weekDate = getDateFromWeekNumber(weekNumber, currentYear)
      const dateStr = weekDate.toISOString().split('T')[0]

      const fuelData = {
        date: dateStr,
        gallons: editValues.gallons || 0,
        price_per_gallon: editValues.pricePerGallon || undefined,
        def_gallons: editValues.defGallons || undefined,
        def_price: editValues.defPrice || undefined,
        total_amount: editValues.totalAmount || 0,
        driver_id: driverId,
        truck_id: editValues.truckId || undefined,
      }

      try {
        if (existing) {
          // Update existing
          await updateFuel.mutateAsync({ id: existing.id, data: fuelData })
        } else {
          // Create new
          await createFuel.mutateAsync(fuelData)
        }
      } catch (error) {
        console.error('Failed to save fuel entry:', error)
      }
    }

    setEditingCell(null)
  }

  const handleDeleteRow = async (weekNumber: number, driverId: number) => {
    const entry = fuelByWeekAndDriver[weekNumber]?.[driverId]
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

  if (driversLoading || fuelLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  const renderFuelRow = (weekNum: number, driver: any, rowIndex: number) => {
    const entry = fuelByWeekAndDriver[weekNum]?.[driver.id]

    const isEditingField = (field: string) =>
      editingCell?.weekNumber === weekNum &&
      editingCell?.driverId === driver.id &&
      editingCell?.field === field

    return (
      <tr
        key={`${weekNum}-${driver.id}`}
        className="border-b transition-colors"
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
        {/* Empty cell for indent */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', width: '20px' }}></td>

        {/* Driver */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}>
            {driver.first_name} {driver.last_name}
          </div>
        </td>

        {/* Truck */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('truckId') ? (
            <select
              className="w-full px-2 py-1 border rounded text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.truckId || ''}
              onChange={(e) => handleCellChange('truckId', parseInt(e.target.value) || null)}
              onBlur={handleCellBlur}
              autoFocus
            >
              <option value="">Select</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truck_number}
                </option>
              ))}
            </select>
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'truckId')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {trucks.find(t => t.id === entry?.truck_id)?.truck_number || '-'}
            </div>
          )}
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
              onClick={() => handleCellClick(weekNum, driver.id, 'gallons')}
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
              onClick={() => handleCellClick(weekNum, driver.id, 'pricePerGallon')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.price_per_gallon ? `$${Number(entry.price_per_gallon).toFixed(3)}` : '-'}
            </div>
          )}
        </td>

        {/* DEF Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)' }}>
          {isEditingField('defGallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              style={{ borderColor: 'var(--monday-border)' }}
              value={editValues.defGallons || ''}
              onChange={(e) => handleCellChange('defGallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'defGallons')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.def_gallons ? Number(entry.def_gallons).toFixed(1) : '-'}
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
              onClick={() => handleCellClick(weekNum, driver.id, 'defPrice')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--monday-text-primary)' }}
            >
              {entry?.def_price ? `$${Number(entry.def_price).toFixed(2)}` : '-'}
            </div>
          )}
        </td>

        {/* Total */}
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
              onClick={() => handleCellClick(weekNum, driver.id, 'totalAmount')}
              className="cursor-pointer rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--monday-done)' }}
            >
              {entry?.total_amount ? formatCurrency(Number(entry.total_amount)) : '-'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
          {entry && (
            <button
              onClick={() => handleDeleteRow(weekNum, driver.id)}
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

  return (
    <Layout>
      <div className="p-4 page-fuel">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--monday-text-primary)' }}>Fuel</h1>

        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '20px' }}></th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Driver</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Truck</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Gallons</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Price/Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>DEF Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>DEF Price</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Total</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allWeeks.map((weekNum) => {
                const isCollapsed = collapsedWeeks.has(weekNum)
                const weekEntries = fuelEntries.filter(e => e.weekNumber === weekNum)
                const weekTotal = weekEntries.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0)
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
                            Week {weekNum} {getWeekDateRange(weekNum, currentYear)}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                            ({weekEntries.length} entries)
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2" colSpan={5}></td>
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

                    {/* Driver Rows */}
                    {!isCollapsed && drivers.map((driver, driverIndex) =>
                      renderFuelRow(weekNum, driver, driverIndex)
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
