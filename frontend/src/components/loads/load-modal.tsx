'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete'
import { useCustomers } from '@/hooks/use-customers'
import { useDrivers } from '@/hooks/use-drivers'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Calculator, Loader2 } from 'lucide-react'

export interface LoadData {
  id?: number
  load_number?: string
  pickup_location?: string
  delivery_location?: string
  customer?: { name: string; mc: string }
  customer_id?: number
  driver?: string
  driver_id?: number
  status?: 'assigned' | 'in_transit' | 'delivered' | 'pending' | 'cancelled'
  rate?: number
  miles?: number
  pickup_date?: string
  pickup_time?: string
  delivery_date?: string
  delivery_time?: string
  ratecon?: boolean
  pod?: boolean
  description?: string
  notes?: string
}

interface LoadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (load: LoadData) => void
  load?: LoadData | null
  mode: 'create' | 'edit'
}

export function LoadModal({ isOpen, onClose, onSave, load, mode }: LoadModalProps) {
  // Fetch real customers and drivers from API
  const { data: customersData } = useCustomers()
  const { data: driversData } = useDrivers()
  const customers = customersData?.items || []
  const drivers = driversData?.items || []
  const [formData, setFormData] = useState<LoadData>({
    load_number: '',
    pickup_location: '',
    delivery_location: '',
    status: 'pending',
    rate: undefined,
    miles: undefined,
    pickup_date: '',
    pickup_time: '',
    delivery_date: '',
    delivery_time: '',
    notes: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isCalculatingMiles, setIsCalculatingMiles] = useState(false)

  // Auto-calculate miles when both addresses are entered
  useEffect(() => {
    const calculateMiles = async () => {
      if (!formData.pickup_location || !formData.delivery_location) {
        return
      }

      // Skip if miles are already set (editing existing load)
      if (formData.miles && mode === 'edit') {
        return
      }

      setIsCalculatingMiles(true)

      try {
        const response = await api.post('/v1/maps/calculate-distance', {
          origin: formData.pickup_location,
          destination: formData.delivery_location,
          unit: 'imperial'
        })

        if (response.data.status === 'success' && response.data.distance_miles) {
          setFormData(prev => ({
            ...prev,
            miles: Math.round(response.data.distance_miles)
          }))
          toast.success(`Calculated ${Math.round(response.data.distance_miles)} miles`)
        } else {
          toast.error(response.data.error || 'Could not calculate distance')
        }
      } catch (error: any) {
        console.error('Error calculating distance:', error)
        // Silently fail - user can still enter miles manually
      } finally {
        setIsCalculatingMiles(false)
      }
    }

    // Debounce the calculation by 1 second
    const timeoutId = setTimeout(calculateMiles, 1000)
    return () => clearTimeout(timeoutId)
  }, [formData.pickup_location, formData.delivery_location])

  useEffect(() => {
    // Only reset form when modal is opened (not on every state change)
    if (!isOpen) return

    if (load && mode === 'edit') {
      setFormData({
        ...load,
        load_number: load.load_number || '',
        pickup_location: load.pickup_location || '',
        delivery_location: load.delivery_location || '',
        status: load.status || 'pending',
        rate: load.rate || 0,
        miles: load.miles || 0,
        pickup_date: load.pickup_date || '',
        pickup_time: load.pickup_time || '',
        delivery_date: load.delivery_date || '',
        delivery_time: load.delivery_time || '',
        driver: load.driver || '',
        customer: load.customer || undefined,
        notes: load.notes || '',
      })
    } else if (mode === 'create') {
      setFormData({
        load_number: `TMS${String(Date.now()).slice(-3)}`,
        pickup_location: '',
        delivery_location: '',
        status: 'pending',
        rate: undefined,
        miles: undefined,
        pickup_date: '',
        pickup_time: '',
        delivery_date: '',
        delivery_time: '',
        notes: '',
      })
    }
    setErrors({})
  }, [load, mode])

  const validateForm = () => {
    // All fields are optional - no validation needed
    setErrors({})
    return true
  }

  const handleSave = () => {
    if (validateForm()) {
      console.log('LoadModal - formData being saved:', JSON.stringify(formData, null, 2))
      console.log('LoadModal - miles value:', formData.miles, 'type:', typeof formData.miles)
      console.log('LoadModal - rate value:', formData.rate, 'type:', typeof formData.rate)
      onSave(formData)
      onClose()
    }
  }

  const handleCustomerChange = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === parseInt(customerId))
    if (selectedCustomer) {
      setFormData({ ...formData, customer_id: selectedCustomer.id })
    }
  }

  const handleDriverChange = (driverId: string) => {
    const selectedDriver = drivers.find(d => d.id === parseInt(driverId))
    if (selectedDriver) {
      setFormData({ ...formData, driver_id: selectedDriver.id })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Load' : 'Edit Load'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Enter the details for the new load. All fields are optional.'
              : 'Update the load information below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="load_number">Load Number</Label>
            <Input
              id="load_number"
              value={formData.load_number}
              onChange={(e) => setFormData({ ...formData, load_number: e.target.value })}
              className={errors.load_number ? 'border-red-500' : ''}
            />
            {errors.load_number && <p className="text-sm text-red-500">{errors.load_number}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status || 'pending'} onValueChange={(value: any) =>
              setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={formData.customer_id?.toString()} onValueChange={handleCustomerChange}>
              <SelectTrigger className={errors.customer ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer && <p className="text-sm text-red-500">{errors.customer}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver">Driver</Label>
            <Select value={formData.driver_id?.toString()} onValueChange={handleDriverChange}>
              <SelectTrigger className={errors.driver ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => {
                  const firstName = driver.first_name.charAt(0).toUpperCase() + driver.first_name.slice(1).toLowerCase()
                  const lastName = driver.last_name.charAt(0).toUpperCase() + driver.last_name.slice(1).toLowerCase()
                  return (
                    <SelectItem key={driver.id} value={driver.id.toString()}>
                      {firstName} {lastName}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {errors.driver && <p className="text-sm text-red-500">{errors.driver}</p>}
          </div>

          <div>
            <AddressAutocomplete
              value={formData.pickup_location || ''}
              onChange={(addressData) => setFormData({ ...formData, pickup_location: addressData.formatted_address })}
              placeholder="Enter zip code or full address"
              className={errors.pickup_location ? 'border-red-500' : ''}
            />
            {errors.pickup_location && <p className="text-sm text-red-500">{errors.pickup_location}</p>}
          </div>

          <div>
            <AddressAutocomplete
              value={formData.delivery_location || ''}
              onChange={(addressData) => setFormData({ ...formData, delivery_location: addressData.formatted_address })}
              placeholder="Enter zip code or full address"
              className={errors.delivery_location ? 'border-red-500' : ''}
            />
            {errors.delivery_location && <p className="text-sm text-red-500">{errors.delivery_location}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_date">Pickup Date</Label>
            <Input
              id="pickup_date"
              type="date"
              value={formData.pickup_date}
              onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
              className={errors.pickup_date ? 'border-red-500 text-green-700' : 'text-green-700'}
            />
            {errors.pickup_date && <p className="text-sm text-red-500">{errors.pickup_date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_time">Pickup Time</Label>
            <Input
              id="pickup_time"
              type="time"
              value={formData.pickup_time}
              onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
              className={errors.pickup_time ? 'border-red-500 text-green-700' : 'text-green-700'}
            />
            {errors.pickup_time && <p className="text-sm text-red-500">{errors.pickup_time}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_date">Delivery Date</Label>
            <Input
              id="delivery_date"
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              className={errors.delivery_date ? 'border-red-500 text-green-700' : 'text-green-700'}
            />
            {errors.delivery_date && <p className="text-sm text-red-500">{errors.delivery_date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_time">Delivery Time</Label>
            <Input
              id="delivery_time"
              type="time"
              value={formData.delivery_time}
              onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
              className={errors.delivery_time ? 'border-red-500 text-green-700' : 'text-green-700'}
            />
            {errors.delivery_time && <p className="text-sm text-red-500">{errors.delivery_time}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Rate ($)</Label>
            <Input
              id="rate"
              type="number"
              value={formData.rate || ''}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value ? parseFloat(e.target.value) : undefined })}
              className={errors.rate ? 'border-red-500' : ''}
              placeholder="0.00"
            />
            {errors.rate && <p className="text-sm text-red-500">{errors.rate}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="miles">Miles</Label>
            <div className="flex gap-2">
              <Input
                id="miles"
                type="number"
                value={formData.miles || ''}
                onChange={(e) => setFormData({ ...formData, miles: e.target.value ? parseInt(e.target.value) : undefined })}
                className={errors.miles ? 'border-red-500' : ''}
                placeholder="0"
                disabled={isCalculatingMiles}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={async () => {
                  if (!formData.pickup_location || !formData.delivery_location) {
                    toast.error('Please enter both pickup and delivery locations')
                    return
                  }

                  setIsCalculatingMiles(true)
                  try {
                    const response = await api.post('/v1/maps/calculate-distance', {
                      origin: formData.pickup_location,
                      destination: formData.delivery_location,
                      unit: 'imperial'
                    })

                    if (response.data.status === 'success' && response.data.distance_miles) {
                      setFormData(prev => ({
                        ...prev,
                        miles: Math.round(response.data.distance_miles)
                      }))
                      toast.success(`Calculated ${Math.round(response.data.distance_miles)} miles`)
                    } else {
                      toast.error(response.data.error || 'Could not calculate distance')
                    }
                  } catch (error: any) {
                    toast.error(error.response?.data?.detail || 'Error calculating distance')
                  } finally {
                    setIsCalculatingMiles(false)
                  }
                }}
                disabled={isCalculatingMiles || !formData.pickup_location || !formData.delivery_location}
                title="Calculate miles using Google Maps"
              >
                {isCalculatingMiles ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.miles && <p className="text-sm text-red-500">{errors.miles}</p>}
            {isCalculatingMiles && <p className="text-sm text-muted-foreground">Calculating distance...</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add any additional notes about this load..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Load' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}