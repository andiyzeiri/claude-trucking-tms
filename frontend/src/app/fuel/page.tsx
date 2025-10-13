'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFuel, useCreateFuel, useUpdateFuel, useDeleteFuel } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { Fuel } from '@/types'
import { format } from 'date-fns'

interface FuelFormData {
  date: string
  location: string
  gallons: string
  price_per_gallon: string
  total_amount: string
  odometer: string
  notes: string
  driver_id: string
  truck_id: string
}

const initialFormData: FuelFormData = {
  date: new Date().toISOString().split('T')[0],
  location: '',
  gallons: '',
  price_per_gallon: '',
  total_amount: '',
  odometer: '',
  notes: '',
  driver_id: '',
  truck_id: ''
}

export default function FuelPage() {
  const [open, setOpen] = useState(false)
  const [editingFuel, setEditingFuel] = useState<Fuel | null>(null)
  const [formData, setFormData] = useState<FuelFormData>(initialFormData)

  const { data: fuelEntries, isLoading } = useFuel()
  const { data: drivers } = useDrivers()
  const { data: trucks } = useTrucks()
  const createFuel = useCreateFuel()
  const updateFuel = useUpdateFuel()
  const deleteFuel = useDeleteFuel()

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEditingFuel(null)
      setFormData(initialFormData)
    }
  }

  const handleEdit = (fuel: Fuel) => {
    setEditingFuel(fuel)
    setFormData({
      date: fuel.date,
      location: fuel.location || '',
      gallons: fuel.gallons.toString(),
      price_per_gallon: fuel.price_per_gallon?.toString() || '',
      total_amount: fuel.total_amount.toString(),
      odometer: fuel.odometer?.toString() || '',
      notes: fuel.notes || '',
      driver_id: fuel.driver_id?.toString() || '',
      truck_id: fuel.truck_id?.toString() || ''
    })
    setOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this fuel entry?')) {
      await deleteFuel.mutateAsync(id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      date: formData.date,
      location: formData.location || undefined,
      gallons: parseFloat(formData.gallons),
      price_per_gallon: formData.price_per_gallon ? parseFloat(formData.price_per_gallon) : undefined,
      total_amount: parseFloat(formData.total_amount),
      odometer: formData.odometer ? parseInt(formData.odometer) : undefined,
      notes: formData.notes || undefined,
      driver_id: formData.driver_id ? parseInt(formData.driver_id) : undefined,
      truck_id: formData.truck_id ? parseInt(formData.truck_id) : undefined
    }

    if (editingFuel) {
      await updateFuel.mutateAsync({ id: editingFuel.id, data })
    } else {
      await createFuel.mutateAsync(data)
    }

    handleOpenChange(false)
  }

  // Calculate total amount automatically when gallons or price changes
  const handleGallonsOrPriceChange = (field: 'gallons' | 'price_per_gallon', value: string) => {
    const newFormData = { ...formData, [field]: value }

    if (newFormData.gallons && newFormData.price_per_gallon) {
      const gallons = parseFloat(newFormData.gallons)
      const pricePerGallon = parseFloat(newFormData.price_per_gallon)
      if (!isNaN(gallons) && !isNaN(pricePerGallon)) {
        newFormData.total_amount = (gallons * pricePerGallon).toFixed(2)
      }
    }

    setFormData(newFormData)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fuel</h1>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Fuel Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFuel ? 'Edit' : 'Add'} Fuel Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Gas station name/location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gallons">Gallons *</Label>
                  <Input
                    id="gallons"
                    type="number"
                    step="0.01"
                    value={formData.gallons}
                    onChange={(e) => handleGallonsOrPriceChange('gallons', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_per_gallon">Price per Gallon</Label>
                  <Input
                    id="price_per_gallon"
                    type="number"
                    step="0.001"
                    value={formData.price_per_gallon}
                    onChange={(e) => handleGallonsOrPriceChange('price_per_gallon', e.target.value)}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_amount">Total Amount *</Label>
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={formData.odometer}
                    onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                    placeholder="Odometer reading"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driver">Driver</Label>
                  <Select
                    value={formData.driver_id}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id.toString()}>
                          {driver.first_name} {driver.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="truck">Truck</Label>
                  <Select
                    value={formData.truck_id}
                    onValueChange={(value) => setFormData({ ...formData, truck_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {trucks?.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id.toString()}>
                          {truck.truck_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingFuel ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Truck</TableHead>
              <TableHead className="text-right">Gallons</TableHead>
              <TableHead className="text-right">Price/Gal</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Odometer</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fuelEntries && fuelEntries.length > 0 ? (
              fuelEntries.map((fuel) => (
                <TableRow key={fuel.id}>
                  <TableCell>{format(new Date(fuel.date), 'MM/dd/yyyy')}</TableCell>
                  <TableCell>{fuel.location || '-'}</TableCell>
                  <TableCell>
                    {fuel.driver ? `${fuel.driver.first_name} ${fuel.driver.last_name}` : '-'}
                  </TableCell>
                  <TableCell>{fuel.truck?.truck_number || '-'}</TableCell>
                  <TableCell className="text-right">{fuel.gallons}</TableCell>
                  <TableCell className="text-right">
                    {fuel.price_per_gallon ? `$${fuel.price_per_gallon}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">${fuel.total_amount}</TableCell>
                  <TableCell>{fuel.odometer || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(fuel)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(fuel.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No fuel entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
