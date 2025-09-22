'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface TruckData {
  id?: number
  unit_number: string
  make: string
  model: string
  year: number
  status: 'available' | 'in_use' | 'maintenance'
  mileage: number
  driver: string | null
}

interface TruckModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (truck: TruckData) => void
  truck?: TruckData | null
  mode: 'create' | 'edit'
}

const makes = ['Freightliner', 'Peterbilt', 'Kenworth', 'Mack', 'International', 'Volvo']
const drivers = ['John Smith', 'Jane Doe', 'Mike Johnson', 'Sarah Wilson', 'David Brown']

export function TruckModal({ isOpen, onClose, onSave, truck, mode }: TruckModalProps) {
  const [formData, setFormData] = useState<TruckData>({
    unit_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    status: 'available',
    mileage: 0,
    driver: null
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (truck && mode === 'edit') {
      setFormData(truck)
    } else if (mode === 'create') {
      setFormData({
        unit_number: `T${String(Date.now()).slice(-3)}`,
        make: '',
        model: '',
        year: new Date().getFullYear(),
        status: 'available',
        mileage: 0,
        driver: null
      })
    }
    setErrors({})
  }, [truck, mode, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.unit_number.trim()) newErrors.unit_number = 'Unit number is required'
    if (!formData.make.trim()) newErrors.make = 'Make is required'
    if (!formData.model.trim()) newErrors.model = 'Model is required'
    if (formData.year < 1990 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Year must be between 1990 and next year'
    }
    if (formData.mileage < 0) newErrors.mileage = 'Mileage must be 0 or greater'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Truck' : 'Edit Truck'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="unit_number">Unit Number</Label>
            <Input
              id="unit_number"
              value={formData.unit_number}
              onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
              className={errors.unit_number ? 'border-red-500' : ''}
            />
            {errors.unit_number && <p className="text-sm text-red-500">{errors.unit_number}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: 'available' | 'in_use' | 'maintenance') =>
              setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="make">Make</Label>
            <Select value={formData.make} onValueChange={(value) => setFormData({ ...formData, make: value })}>
              <SelectTrigger className={errors.make ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select make" />
              </SelectTrigger>
              <SelectContent>
                {makes.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.make && <p className="text-sm text-red-500">{errors.make}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={errors.model ? 'border-red-500' : ''}
              placeholder="e.g., Cascadia, 579"
            />
            {errors.model && <p className="text-sm text-red-500">{errors.model}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
              className={errors.year ? 'border-red-500' : ''}
              min="1990"
              max={new Date().getFullYear() + 1}
            />
            {errors.year && <p className="text-sm text-red-500">{errors.year}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage">Mileage</Label>
            <Input
              id="mileage"
              type="number"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: parseInt(e.target.value) || 0 })}
              className={errors.mileage ? 'border-red-500' : ''}
              placeholder="0"
            />
            {errors.mileage && <p className="text-sm text-red-500">{errors.mileage}</p>}
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="driver">Assigned Driver</Label>
            <Select
              value={formData.driver || ''}
              onValueChange={(value) => setFormData({ ...formData, driver: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver} value={driver}>
                    {driver}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Add Truck' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}