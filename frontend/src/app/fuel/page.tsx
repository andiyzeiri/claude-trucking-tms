'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Fuel } from '@/types'
import toast from 'react-hot-toast'

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

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Fuel</h1>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 text-left w-40">Week</th>
                <th className="p-2 text-left w-48">Driver</th>
                <th className="p-2 text-left w-32">Date</th>
                <th className="p-2 text-left w-32">Truck</th>
                <th className="p-2 text-right w-28">Gallons</th>
                <th className="p-2 text-right w-28">Price/Gal</th>
                <th className="p-2 text-right w-28">DEF Gal</th>
                <th className="p-2 text-right w-28">DEF Price</th>
                <th className="p-2 text-right w-32">Total</th>
                <th className="p-2 w-10"></th>
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
                      className="bg-cyan-50 border-b border-gray-200 cursor-pointer hover:bg-cyan-100"
                      onClick={() => toggleWeek(weekNum)}
                    >
                      <td colSpan={2} className="px-2 py-2 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="whitespace-nowrap">Week {weekNum} {getWeekDateRange(weekNum, currentYear)}</span>
                          <span className="text-gray-500 whitespace-nowrap">
                            ({allWeekFuel.length} entries)
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-sm" colSpan={4}></td>
                      <td className="px-2 py-2 text-sm text-right font-semibold">
                        {weekGallons.toFixed(1)} gal
                      </td>
                      <td className="px-2 py-2 text-sm text-right font-semibold text-green-700">
                        ${weekTotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2"></td>
                    </tr>

                    {/* Driver Rows */}
                    {!isCollapsed && drivers.map(driver => {
                      const driverFuelEntries = weekDrivers[driver.id] || []
                      const mainEntry = driverFuelEntries[0] // Show first entry for this driver in this week

                      const isEditing = (field: string) =>
                        editingCell?.weekNumber === weekNum &&
                        editingCell?.driverId === driver.id &&
                        editingCell?.field === field

                      const cellValue = (field: string) => {
                        if (isEditing(field)) {
                          return editValues[field]
                        }
                        return mainEntry?.[field as keyof Fuel]
                      }

                      return (
                        <tr key={`${weekNum}-${driver.id}`} className="border-b hover:bg-gray-50">
                          <td className="p-2"></td>
                          <td className="p-2 text-sm">
                            {driver.first_name} {driver.last_name}
                          </td>
                          <td className="p-2">
                            {isEditing('date') ? (
                              <input
                                type="date"
                                className="w-full px-2 py-1 border rounded text-sm"
                                value={editValues.date || ''}
                                onChange={(e) => handleCellChange('date', e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => handleCellClick(weekNum, driver.id, 'date', mainEntry)}
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry ? new Date(mainEntry.date).toLocaleDateString() : '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing('truck_id') ? (
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
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry?.truck?.truck_number || '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {isEditing('gallons') ? (
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
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry?.gallons?.toFixed(1) || '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {isEditing('price_per_gallon') ? (
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
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry?.price_per_gallon ? `$${mainEntry.price_per_gallon.toFixed(3)}` : '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {isEditing('def_gallons') ? (
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
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry?.def_gallons?.toFixed(1) || '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {isEditing('def_price') ? (
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
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              >
                                {mainEntry?.def_price ? `$${mainEntry.def_price.toFixed(2)}` : '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {isEditing('total_amount') ? (
                              <input
                                type="number"
                                step="0.01"
                                className="w-full px-2 py-1 border rounded text-right text-sm font-semibold"
                                value={editValues.total_amount || ''}
                                onChange={(e) => handleCellChange('total_amount', parseFloat(e.target.value) || 0)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => handleCellClick(weekNum, driver.id, 'total_amount', mainEntry)}
                                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded font-semibold"
                              >
                                {mainEntry?.total_amount ? `$${mainEntry.total_amount.toFixed(2)}` : '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
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
                    })}
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
