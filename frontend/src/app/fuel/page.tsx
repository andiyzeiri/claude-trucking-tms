'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Input } from '@/components/ui/input'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Fuel } from '@/types'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface EditableFuel extends Fuel {
  isNew?: boolean
}

type EditingCell = {
  fuelId: number | 'new'
  field: string
} | null

// Get week number from date
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNum
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
  const [newRow, setNewRow] = useState<Partial<Fuel>>({
    date: new Date().toISOString().split('T')[0],
    gallons: 0,
    price_per_gallon: 0,
    total_amount: 0,
  })

  // Group fuel by week
  const groupedFuel = useMemo(() => {
    if (!fuelData) return []

    const fuelWithWeek = (fuelData as Fuel[]).map(fuel => ({
      ...fuel,
      weekNumber: getWeekNumber(new Date(fuel.date)),
    }))

    fuelWithWeek.sort((a, b) => {
      if (b.weekNumber !== a.weekNumber) return b.weekNumber - a.weekNumber
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return fuelWithWeek
  }, [fuelData])

  const handleCellClick = (fuelId: number, field: string) => {
    setEditingCell({ fuelId, field })
    const fuel = groupedFuel.find(f => f.id === fuelId)
    if (fuel) {
      setEditValues({ ...fuel })
    }
  }

  const handleCellChange = (field: string, value: any) => {
    setEditValues(prev => {
      const updated = { ...prev, [field]: value }

      // Auto-calculate total if gallons or price changes
      if (field === 'gallons' || field === 'price_per_gallon') {
        const gallons = parseFloat(updated.gallons || 0)
        const price = parseFloat(updated.price_per_gallon || 0)
        updated.total_amount = (gallons * price).toFixed(2)
      }

      return updated
    })
  }

  const handleCellBlur = async () => {
    if (!editingCell || editingCell.fuelId === 'new') {
      setEditingCell(null)
      return
    }

    try {
      await updateFuel.mutateAsync({
        id: editingCell.fuelId as number,
        data: editValues
      })
      setEditingCell(null)
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  const handleAddRow = async () => {
    if (!newRow.driver_id || !newRow.truck_id) {
      toast.error('Please select driver and truck')
      return
    }

    try {
      await createFuel.mutateAsync({
        date: newRow.date!,
        driver_id: newRow.driver_id,
        truck_id: newRow.truck_id,
        gallons: newRow.gallons || 0,
        price_per_gallon: newRow.price_per_gallon || 0,
        total_amount: newRow.total_amount || 0,
      })

      setNewRow({
        date: new Date().toISOString().split('T')[0],
        gallons: 0,
        price_per_gallon: 0,
        total_amount: 0,
      })
    } catch (error) {
      console.error('Create failed:', error)
    }
  }

  const handleDeleteRow = async (id: number) => {
    if (confirm('Delete this fuel entry?')) {
      await deleteFuel.mutateAsync(id)
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
                <th className="p-2 text-left w-16">Week</th>
                <th className="p-2 text-left w-24">Date</th>
                <th className="p-2 text-left w-32">Driver</th>
                <th className="p-2 text-left w-24">Truck</th>
                <th className="p-2 text-left w-32">Location</th>
                <th className="p-2 text-right w-24">Gallons</th>
                <th className="p-2 text-right w-24">Price/Gal</th>
                <th className="p-2 text-right w-24">DEF Gal</th>
                <th className="p-2 text-right w-24">DEF Price</th>
                <th className="p-2 text-right w-24">Total</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {/* New row */}
              <tr className="bg-blue-50 border-b">
                <td className="p-2">New</td>
                <td className="p-2">
                  <input
                    type="date"
                    className="w-full px-2 py-1 border rounded"
                    value={newRow.date || ''}
                    onChange={(e) => setNewRow({ ...newRow, date: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <select
                    className="w-full px-2 py-1 border rounded"
                    value={newRow.driver_id || ''}
                    onChange={(e) => setNewRow({ ...newRow, driver_id: parseInt(e.target.value) })}
                  >
                    <option value="">Select</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.first_name} {driver.last_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    className="w-full px-2 py-1 border rounded"
                    value={newRow.truck_id || ''}
                    onChange={(e) => setNewRow({ ...newRow, truck_id: parseInt(e.target.value) })}
                  >
                    <option value="">Select</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truck_number}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full px-2 py-1 border rounded"
                    value={newRow.location || ''}
                    onChange={(e) => setNewRow({ ...newRow, location: e.target.value })}
                    placeholder="Location"
                  />
                </td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2 py-1 border rounded text-right"
                    value={newRow.gallons || ''}
                    onChange={(e) => {
                      const gallons = parseFloat(e.target.value) || 0
                      const total = gallons * (newRow.price_per_gallon || 0)
                      setNewRow({ ...newRow, gallons, total_amount: total })
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    step="0.001"
                    className="w-full px-2 py-1 border rounded text-right"
                    value={newRow.price_per_gallon || ''}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0
                      const total = (newRow.gallons || 0) * price
                      setNewRow({ ...newRow, price_per_gallon: price, total_amount: total })
                    }}
                  />
                </td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right font-semibold">
                  ${(newRow.total_amount || 0).toFixed(2)}
                </td>
                <td className="p-2">
                  <button
                    onClick={handleAddRow}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                  >
                    Add
                  </button>
                </td>
              </tr>

              {/* Existing rows */}
              {groupedFuel.map((fuel) => {
                const isEditing = (field: string) =>
                  editingCell?.fuelId === fuel.id && editingCell?.field === field

                return (
                  <tr key={fuel.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{fuel.weekNumber}</td>
                    <td className="p-2">
                      {isEditing('date') ? (
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded"
                          value={editValues.date || ''}
                          onChange={(e) => handleCellChange('date', e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'date')}>
                          {new Date(fuel.date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing('driver_id') ? (
                        <select
                          className="w-full px-2 py-1 border rounded"
                          value={editValues.driver_id || ''}
                          onChange={(e) => handleCellChange('driver_id', parseInt(e.target.value))}
                          onBlur={handleCellBlur}
                          autoFocus
                        >
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.first_name} {driver.last_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'driver_id')}>
                          {fuel.driver ? `${fuel.driver.first_name} ${fuel.driver.last_name}` : '-'}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing('truck_id') ? (
                        <select
                          className="w-full px-2 py-1 border rounded"
                          value={editValues.truck_id || ''}
                          onChange={(e) => handleCellChange('truck_id', parseInt(e.target.value))}
                          onBlur={handleCellBlur}
                          autoFocus
                        >
                          {trucks.map((truck) => (
                            <option key={truck.id} value={truck.id}>
                              {truck.truck_number}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'truck_id')}>
                          {fuel.truck?.truck_number || '-'}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing('location') ? (
                        <input
                          type="text"
                          className="w-full px-2 py-1 border rounded"
                          value={editValues.location || ''}
                          onChange={(e) => handleCellChange('location', e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'location')}>
                          {fuel.location || '-'}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {isEditing('gallons') ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1 border rounded text-right"
                          value={editValues.gallons || ''}
                          onChange={(e) => handleCellChange('gallons', parseFloat(e.target.value))}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'gallons')}>
                          {fuel.gallons}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {isEditing('price_per_gallon') ? (
                        <input
                          type="number"
                          step="0.001"
                          className="w-full px-2 py-1 border rounded text-right"
                          value={editValues.price_per_gallon || ''}
                          onChange={(e) => handleCellChange('price_per_gallon', parseFloat(e.target.value))}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellClick(fuel.id, 'price_per_gallon')}>
                          ${fuel.price_per_gallon?.toFixed(3) || '-'}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right text-gray-400">-</td>
                    <td className="p-2 text-right text-gray-400">-</td>
                    <td className="p-2 text-right font-semibold">
                      ${fuel.total_amount.toFixed(2)}
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => handleDeleteRow(fuel.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          * DEF (Diesel Exhaust Fluid) tracking coming soon
        </div>
      </div>
    </Layout>
  )
}
