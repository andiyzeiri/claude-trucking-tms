'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { DedicatedLane, DedicatedLaneCreate, useCreateDedicatedLane, useUpdateDedicatedLane } from '@/hooks/use-dedicated-lanes'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'

interface DedicatedLaneModalProps {
  lane: DedicatedLane | null
  onClose: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

export function DedicatedLaneModal({ lane, onClose }: DedicatedLaneModalProps) {
  const isEditing = !!lane
  const createDedicatedLane = useCreateDedicatedLane()
  const updateDedicatedLane = useUpdateDedicatedLane()

  const { data: customersData } = useCustomers()
  const customers = customersData?.items || []

  const { data: driversData } = useDrivers()
  const drivers = driversData?.items || []

  const { data: trucksData } = useTrucks()
  const trucks = trucksData?.items || []

  // Form state
  const [formData, setFormData] = useState<Partial<DedicatedLaneCreate>>({
    name: '',
    pickup_location: '',
    delivery_location: '',
    miles: undefined,
    day_of_week: 0,
    pickup_time: '',
    delivery_time: '',
    rate: undefined,
    carrier_rate: undefined,
    fuel_surcharge: 0,
    accessorial_charges: 0,
    pickup_notes: '',
    delivery_notes: '',
    reference_number: '',
    is_active: true,
    customer_id: undefined,
    driver_id: undefined,
    truck_id: undefined,
  })

  // Populate form when editing
  useEffect(() => {
    if (lane) {
      setFormData({
        name: lane.name,
        pickup_location: lane.pickup_location,
        delivery_location: lane.delivery_location,
        miles: lane.miles,
        day_of_week: lane.day_of_week,
        pickup_time: lane.pickup_time || '',
        delivery_time: lane.delivery_time || '',
        rate: lane.rate,
        carrier_rate: lane.carrier_rate,
        fuel_surcharge: lane.fuel_surcharge || 0,
        accessorial_charges: lane.accessorial_charges || 0,
        pickup_notes: lane.pickup_notes || '',
        delivery_notes: lane.delivery_notes || '',
        reference_number: lane.reference_number || '',
        is_active: lane.is_active,
        customer_id: lane.customer_id,
        driver_id: lane.driver_id,
        truck_id: lane.truck_id,
      })
    }
  }, [lane])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.pickup_location || !formData.delivery_location || !formData.customer_id) {
      return
    }

    try {
      if (isEditing && lane) {
        await updateDedicatedLane.mutateAsync({
          id: lane.id,
          data: formData
        })
      } else {
        await createDedicatedLane.mutateAsync(formData as DedicatedLaneCreate)
      }
      onClose()
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleChange = (field: keyof DedicatedLaneCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--monday-border-light)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
            {isEditing ? 'Edit Dedicated Lane' : 'Add Dedicated Lane'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Lane Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
              Lane Name *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Atlanta to Jacksonville Weekly"
              required
            />
          </div>

          {/* Route */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Pickup Location *
              </label>
              <Input
                value={formData.pickup_location || ''}
                onChange={(e) => handleChange('pickup_location', e.target.value)}
                placeholder="City, State"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Delivery Location *
              </label>
              <Input
                value={formData.delivery_location || ''}
                onChange={(e) => handleChange('delivery_location', e.target.value)}
                placeholder="City, State"
                required
              />
            </div>
          </div>

          {/* Day of Week and Times */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Day of Week *
              </label>
              <Select
                value={String(formData.day_of_week)}
                onValueChange={(value) => handleChange('day_of_week', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Pickup Time
              </label>
              <Input
                type="time"
                value={formData.pickup_time || ''}
                onChange={(e) => handleChange('pickup_time', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Delivery Time
              </label>
              <Input
                type="time"
                value={formData.delivery_time || ''}
                onChange={(e) => handleChange('delivery_time', e.target.value)}
              />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
              Customer *
            </label>
            <Select
              value={formData.customer_id ? String(formData.customer_id) : ''}
              onValueChange={(value) => handleChange('customer_id', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Driver and Truck */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Driver (Optional)
              </label>
              <Select
                value={formData.driver_id ? String(formData.driver_id) : 'none'}
                onValueChange={(value) => handleChange('driver_id', value === 'none' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No driver assigned</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={String(driver.id)}>
                      {driver.first_name} {driver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Truck (Optional)
              </label>
              <Select
                value={formData.truck_id ? String(formData.truck_id) : 'none'}
                onValueChange={(value) => handleChange('truck_id', value === 'none' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No truck assigned</SelectItem>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={String(truck.id)}>
                      {truck.unit_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Financial */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Rate ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.rate || ''}
                onChange={(e) => handleChange('rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Carrier Rate ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.carrier_rate || ''}
                onChange={(e) => handleChange('carrier_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Miles
              </label>
              <Input
                type="number"
                value={formData.miles || ''}
                onChange={(e) => handleChange('miles', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Fuel Surcharge ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.fuel_surcharge || ''}
                onChange={(e) => handleChange('fuel_surcharge', e.target.value ? parseFloat(e.target.value) : 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Pickup Notes
              </label>
              <Textarea
                value={formData.pickup_notes || ''}
                onChange={(e) => handleChange('pickup_notes', e.target.value)}
                placeholder="Standing pickup instructions..."
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Delivery Notes
              </label>
              <Textarea
                value={formData.delivery_notes || ''}
                onChange={(e) => handleChange('delivery_notes', e.target.value)}
                placeholder="Standing delivery instructions..."
                rows={2}
              />
            </div>
          </div>

          {/* Reference Number and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Reference Number
              </label>
              <Input
                value={formData.reference_number || ''}
                onChange={(e) => handleChange('reference_number', e.target.value)}
                placeholder="Optional reference"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--monday-text-secondary)' }}>
                Status
              </label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onValueChange={(value) => handleChange('is_active', value === 'active')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--monday-border-light)' }}>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDedicatedLane.isPending || updateDedicatedLane.isPending}
              style={{ backgroundColor: '#0086c0' }}
            >
              {createDedicatedLane.isPending || updateDedicatedLane.isPending
                ? 'Saving...'
                : isEditing
                ? 'Update Lane'
                : 'Create Lane'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
