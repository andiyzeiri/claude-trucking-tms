'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Fuel } from '@/types'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

interface EditableFuel extends Fuel {
  isNew?: boolean
  weekNumber?: number
}

type EditingCell = {
  weekNumber: number
  driverId: number
  field: string
} | null

// Get week number from date (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNum
}

// Get date from week number (ISO 8601)
function getDateFromWeekNumber(weekNumber: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()
  const jan4 = new Date(Date.UTC(currentYear, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum + 1)
  const targetDate = new Date(week1Monday)
  targetDate.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7)
  return new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())
}

// Get week date range
function getWeekDateRange(weekNumber: number, year?: number): string {
  const monday = getDateFromWeekNumber(weekNumber, year)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startMonth = monday.getMonth() + 1
  const startDay = monday.getDate()
  const endMonth = sunday.getMonth() + 1
  const endDay = sunday.getDate()

  return `(${startMonth}/${startDay}-${endMonth}/${endDay})`
}

export default function FuelPage() {
  const { data: fuelData, isLoading } = useFuel()
  const { data: driversData } = useDrivers()
  const { data: trucksData } = useTrucks()
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

  // Generate all 52 weeks
  const allWeeks = useMemo(() => {
    const weeks = []
    for (let i = 1; i <= 52; i++) {
      weeks.push(i)
    }
    return weeks
  }, [])

  // Group fuel by week and driver
  const fuelByWeekAndDriver = useMemo(() => {
    if (!fuelData) return {}

    const grouped: Record<number, Record<number, Fuel[]>> = {}

    // Initialize all weeks with all drivers
    allWeeks.forEach(weekNum => {
      grouped[weekNum] = {}
      drivers.forEach(driver => {
        grouped[weekNum][driver.id] = []
      })
    })

    // Populate with actual fuel data
    (fuelData as Fuel[]).forEach(fuel => {
      const weekNum = getWeekNumber(new Date(fuel.date))
      if (!grouped[weekNum]) {
        grouped[weekNum] = {}
      }
      if (fuel.driver_id) {
        if (!grouped[weekNum][fuel.driver_id]) {
          grouped[weekNum][fuel.driver_id] = []
        }
        grouped[weekNum][fuel.driver_id].push(fuel)
      }
    })

    return grouped
  }, [fuelData, drivers, allWeeks])

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

  const handleCellClick = (weekNumber: number, driverId: number, field: string, currentFuel?: Fuel) => {
    setEditingCell({ weekNumber, driverId, field })
    if (currentFuel) {
      setEditValues({ ...currentFuel })
    } else {
      // Initialize with defaults for new entry
      const weekDate = getDateFromWeekNumber(weekNumber, currentYear)
      setEditValues({
        date: weekDate.toISOString().split('T')[0],
        driver_id: driverId,
        truck_id: null,
        gallons: 0,
        price_per_gallon: 0,
        def_gallons: 0,
        def_price: 0,
        total_amount: 0,
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
    if (!editingCell) {
      setEditingCell(null)
      return
    }

    const { weekNumber, driverId } = editingCell

    // Find existing fuel entry for this week/driver
    const driverFuelEntries = fuelByWeekAndDriver[weekNumber]?.[driverId] || []
    const existingEntry = driverFuelEntries[0] // For now, use first entry

    try {
      if (existingEntry) {
        // Update existing entry
        await updateFuel.mutateAsync({
          id: existingEntry.id,
          data: editValues
        })
      } else {
        // Create new entry
        if (!editValues.truck_id) {
          toast.error('Please select a truck')
          setEditingCell(null)
          return
        }
        await createFuel.mutateAsync({
          date: editValues.date,
          driver_id: driverId,
          truck_id: editValues.truck_id,
          gallons: editValues.gallons || 0,
          price_per_gallon: editValues.price_per_gallon || 0,
          def_gallons: editValues.def_gallons || 0,
          def_price: editValues.def_price || 0,
          total_amount: editValues.total_amount || 0,
        })
      }
      setEditingCell(null)
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  const handleDeleteRow = async (fuel: Fuel) => {
    if (confirm('Delete this fuel entry?')) {
      await deleteFuel.mutateAsync(fuel.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  if (isLoading) {
    return <Layout><div className="p-8">Loading...</div></Layout>
  }

  // Render a fuel entry row
  const renderFuelRow = (weekNum: number, driver: any, mainEntry: Fuel | undefined, rowIndex: number) => {
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    const isEditingField = (field: string) =>
      editingCell?.weekNumber === weekNum &&
      editingCell?.driverId === driver.id &&
      editingCell?.field === field

    return (
      <tr
        key={`${weekNum}-${driver.id}`}
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
      >
        {/* Empty cell for indent */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)', width: '20px' }}></td>

        {/* Driver */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)' }}>
          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}>
            {driver.first_name} {driver.last_name}
          </div>
        </td>

        {/* Truck */}
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('truck_id') ? (
            <select
              className="w-full px-2 py-1 border rounded text-sm"
              value={editValues.truck_id || ''}
              onChange={(e) => handleCellChange('truck_id', parseInt(e.target.value))}
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
              onClick={() => handleCellClick(weekNum, driver.id, 'truck_id', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {mainEntry?.truck?.truck_number || '-'}
            </div>
          )}
        </td>

        {/* Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('gallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.gallons || ''}
              onChange={(e) => handleCellChange('gallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'gallons', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {mainEntry?.gallons?.toFixed(1) || '-'}
            </div>
          )}
        </td>

        {/* Price/Gal */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('price_per_gallon') ? (
            <input
              type="number"
              step="0.001"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.price_per_gallon || ''}
              onChange={(e) => handleCellChange('price_per_gallon', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'price_per_gallon', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {mainEntry?.price_per_gallon ? `$${Number(mainEntry.price_per_gallon).toFixed(3)}` : '-'}
            </div>
          )}
        </td>

        {/* DEF Gallons */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('def_gallons') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.def_gallons || ''}
              onChange={(e) => handleCellChange('def_gallons', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'def_gallons', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {mainEntry?.def_gallons ? Number(mainEntry.def_gallons).toFixed(1) : '-'}
            </div>
          )}
        </td>

        {/* DEF Price */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('def_price') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.def_price || ''}
              onChange={(e) => handleCellChange('def_price', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'def_price', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)' }}
            >
              {mainEntry?.def_price ? `$${Number(mainEntry.def_price).toFixed(2)}` : '-'}
            </div>
          )}
        </td>

        {/* Total */}
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {isEditingField('total_amount') ? (
            <input
              type="number"
              step="0.01"
              className="w-full px-2 py-1 border rounded text-right text-sm"
              value={editValues.total_amount || ''}
              onChange={(e) => handleCellChange('total_amount', parseFloat(e.target.value) || 0)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              onClick={() => handleCellClick(weekNum, driver.id, 'total_amount', mainEntry)}
              className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5"
              style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: '#16a34a' }}
            >
              {mainEntry?.total_amount ? formatCurrency(Number(mainEntry.total_amount)) : '-'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--cell-borderColor)' }}>
          {mainEntry && (
            <button
              onClick={() => handleDeleteRow(mainEntry)}
              className="p-1 hover:bg-red-100 rounded"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--colors-foreground-default)' }}>Fuel</h1>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--cell-background-header)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)', width: '20px' }}></th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Driver</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Truck</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Gallons</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Price/Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>DEF Gal</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>DEF Price</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)' }}>Total</th>
                <th className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--cell-borderColor)', fontSize: '12px', fontWeight: 500, color: 'var(--colors-foreground-muted)', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allWeeks.map((weekNum) => {
                const isCollapsed = collapsedWeeks.has(weekNum)
                const weekDrivers = fuelByWeekAndDriver[weekNum] || {}
                const allWeekFuel = Object.values(weekDrivers).flat()
                const weekTotal = allWeekFuel.reduce((sum, f) => sum + (Number(f.total_amount) || 0), 0)
                const weekGallons = allWeekFuel.reduce((sum, f) => sum + (Number(f.gallons) || 0), 0)

                return (
                  <React.Fragment key={weekNum}>
                    {/* Week Header */}
                    <tr
                      className="bg-cyan-50 border-b cursor-pointer"
                      style={{ borderColor: 'var(--cell-borderColor)' }}
                      onClick={() => toggleWeek(weekNum)}
                    >
                      <td colSpan={2} className="px-2 py-2" style={{ paddingLeft: '8px' }}>
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--colors-foreground-default)' }}>
                            Week {weekNum} {getWeekDateRange(weekNum, currentYear)}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--colors-foreground-muted)' }}>
                            ({allWeekFuel.length} entries)
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2" colSpan={5}></td>
                      <td className="px-2 py-2">
                        <div className="mb-0.5">
                          <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: '#16a34a' }}>
                            {formatCurrency(weekTotal)}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', lineHeight: '16px', fontWeight: 500, color: '#2563eb' }}>
                          {weekGallons.toFixed(1)} gal
                        </div>
                      </td>
                      <td className="px-2 py-2"></td>
                    </tr>

                    {/* Driver Rows */}
                    {!isCollapsed && drivers.map((driver, driverIndex) => {
                      const driverFuelEntries = weekDrivers[driver.id] || []
                      const mainEntry = driverFuelEntries[0]
                      return renderFuelRow(weekNum, driver, mainEntry, driverIndex)
                    })}

                    {/* Add fuel entry button */}
                    {!isCollapsed && (
                      <tr className="border-b" style={{ borderColor: 'var(--cell-borderColor)' }}>
                        <td colSpan={9} className="px-2 py-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Create a new fuel entry for this week
                              const weekDate = getDateFromWeekNumber(weekNum, currentYear)
                              if (drivers.length > 0 && trucks.length > 0) {
                                createFuel.mutate({
                                  date: weekDate.toISOString().split('T')[0],
                                  driver_id: drivers[0].id,
                                  truck_id: trucks[0].id,
                                  gallons: 0,
                                  price_per_gallon: 0,
                                  def_gallons: 0,
                                  def_price: 0,
                                  total_amount: 0,
                                })
                              } else {
                                toast.error('Please add drivers and trucks first')
                              }
                            }}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            style={{ marginLeft: '20px' }}
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add fuel entry to Week {weekNum}</span>
                          </button>
                        </td>
                      </tr>
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
