'use client'

import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { useFuel, useCreateFuel, useUpdateFuel } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Fuel } from '@/types'

interface FuelWeeklyRow {
  id?: number
  week: string
  weekStart: Date
  driver_id: number
  driverName: string
  truck_id: number
  truckNumber: string
  gallons: number
  pricePerGallon: number
  defGallons: number
  defPrice: number
  total: number
}

export default function FuelPage() {
  const { data: fuelEntries, isLoading } = useFuel()
  const { data: driversData } = useDrivers()
  const { data: trucksData } = useTrucks()
  const createFuel = useCreateFuel()
  const updateFuel = useUpdateFuel()

  const drivers = driversData?.items || []
  const trucks = trucksData?.items || []

  // Group fuel entries by week, driver, and truck
  const weeklyData = useMemo(() => {
    if (!fuelEntries) return []

    const grouped: { [key: string]: FuelWeeklyRow } = {}

    fuelEntries.forEach((entry) => {
      const date = new Date(entry.date)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Start week on Monday
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
      const weekKey = format(weekStart, 'yyyy-MM-dd')
      const weekLabel = `${format(weekStart, 'MM/dd')} - ${format(weekEnd, 'MM/dd')}`

      const driverName = entry.driver
        ? `${entry.driver.first_name} ${entry.driver.last_name}`
        : 'Unknown'

      const truckNumber = entry.truck?.truck_number || 'Unknown'

      const key = `${weekKey}-${entry.driver_id}-${entry.truck_id}`

      if (!grouped[key]) {
        grouped[key] = {
          id: entry.id,
          week: weekLabel,
          weekStart,
          driver_id: entry.driver_id || 0,
          driverName,
          truck_id: entry.truck_id || 0,
          truckNumber,
          gallons: 0,
          pricePerGallon: 0,
          defGallons: 0,
          defPrice: 0,
          total: 0,
        }
      }

      grouped[key].gallons += Number(entry.gallons) || 0
      grouped[key].total += Number(entry.total_amount) || 0

      // Calculate average price per gallon
      if (entry.price_per_gallon) {
        grouped[key].pricePerGallon = Number(entry.price_per_gallon)
      }
    })

    return Object.values(grouped).sort((a, b) =>
      b.weekStart.getTime() - a.weekStart.getTime()
    )
  }, [fuelEntries])

  const [newRow, setNewRow] = useState<Partial<FuelWeeklyRow>>({
    gallons: 0,
    pricePerGallon: 0,
    defGallons: 0,
    defPrice: 0,
  })

  const handleAddRow = async () => {
    if (!newRow.driver_id || !newRow.truck_id) {
      alert('Please select driver and truck')
      return
    }

    const total = (newRow.gallons || 0) * (newRow.pricePerGallon || 0)

    await createFuel.mutateAsync({
      date: new Date().toISOString().split('T')[0],
      driver_id: newRow.driver_id,
      truck_id: newRow.truck_id,
      gallons: newRow.gallons || 0,
      price_per_gallon: newRow.pricePerGallon || 0,
      total_amount: total,
    })

    setNewRow({
      gallons: 0,
      pricePerGallon: 0,
      defGallons: 0,
      defPrice: 0,
    })
  }

  if (isLoading) {
    return <div className="container mx-auto py-8">Loading...</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fuel Summary by Week</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Week</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Truck</TableHead>
              <TableHead className="text-right w-24">Gallons</TableHead>
              <TableHead className="text-right w-24">Price/Gal</TableHead>
              <TableHead className="text-right w-24">DEF Gallons</TableHead>
              <TableHead className="text-right w-24">DEF Price</TableHead>
              <TableHead className="text-right w-28">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Add new row */}
            <TableRow className="bg-muted/50">
              <TableCell>Current Week</TableCell>
              <TableCell>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={newRow.driver_id || ''}
                  onChange={(e) => setNewRow({ ...newRow, driver_id: parseInt(e.target.value) })}
                >
                  <option value="">Select Driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={newRow.truck_id || ''}
                  onChange={(e) => setNewRow({ ...newRow, truck_id: parseInt(e.target.value) })}
                >
                  <option value="">Select Truck</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.truck_number}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  className="w-20 text-right"
                  value={newRow.gallons || ''}
                  onChange={(e) => setNewRow({ ...newRow, gallons: parseFloat(e.target.value) || 0 })}
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.001"
                  className="w-20 text-right"
                  value={newRow.pricePerGallon || ''}
                  onChange={(e) => setNewRow({ ...newRow, pricePerGallon: parseFloat(e.target.value) || 0 })}
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  className="w-20 text-right"
                  value={newRow.defGallons || ''}
                  onChange={(e) => setNewRow({ ...newRow, defGallons: parseFloat(e.target.value) || 0 })}
                  disabled
                  placeholder="0"
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  className="w-20 text-right"
                  value={newRow.defPrice || ''}
                  onChange={(e) => setNewRow({ ...newRow, defPrice: parseFloat(e.target.value) || 0 })}
                  disabled
                  placeholder="0"
                />
              </TableCell>
              <TableCell className="text-right font-semibold">
                ${((newRow.gallons || 0) * (newRow.pricePerGallon || 0)).toFixed(2)}
              </TableCell>
              <TableCell>
                <button
                  onClick={handleAddRow}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Add
                </button>
              </TableCell>
            </TableRow>

            {/* Display grouped weekly data */}
            {weeklyData.length > 0 ? (
              weeklyData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.week}</TableCell>
                  <TableCell>{row.driverName}</TableCell>
                  <TableCell>{row.truckNumber}</TableCell>
                  <TableCell className="text-right">{row.gallons.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${row.pricePerGallon.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                  <TableCell className="text-right font-semibold">${row.total.toFixed(2)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No fuel data found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <p>* DEF (Diesel Exhaust Fluid) tracking coming soon</p>
      </div>
    </div>
  )
}
