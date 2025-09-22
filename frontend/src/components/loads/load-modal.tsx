'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface LoadData {
  id?: number
  load_number: string
  pickup_location: string
  delivery_location: string
  customer: { name: string; mc: string }
  driver: string
  status: 'assigned' | 'in_transit' | 'delivered'
  rate: number
  miles: number
  pickup_date: string
  pickup_time: string
  delivery_date: string
  delivery_time: string
  ratecon: boolean
  pod: boolean
}

interface LoadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (load: LoadData) => void
  load?: LoadData | null
  mode: 'create' | 'edit'
}

const customers = [
  { name: 'ABC Logistics', mc: 'MC-123456' },
  { name: 'XYZ Shipping', mc: 'MC-789012' },
  { name: 'Global Transport', mc: 'MC-345678' },
  { name: 'Fast Freight', mc: 'MC-901234' },
  { name: 'Prime Logistics', mc: 'MC-567890' }
]

const drivers = ['John Smith', 'Jane Doe', 'Mike Johnson', 'Sarah Wilson', 'David Brown']

export function LoadModal({ isOpen, onClose, onSave, load, mode }: LoadModalProps) {
  const [formData, setFormData] = useState<LoadData>({
    load_number: '',
    pickup_location: '',
    delivery_location: '',
    customer: { name: '', mc: '' },
    driver: '',
    status: 'assigned',
    rate: 0,
    miles: 0,
    pickup_date: '',
    pickup_time: '',
    delivery_date: '',
    delivery_time: '',
    ratecon: false,
    pod: false
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (load && mode === 'edit') {
      setFormData(load)
    } else if (mode === 'create') {
      setFormData({
        load_number: `TMS${String(Date.now()).slice(-3)}`,
        pickup_location: '',
        delivery_location: '',
        customer: { name: '', mc: '' },
        driver: '',
        status: 'assigned',
        rate: 0,
        miles: 0,
        pickup_date: '',
        pickup_time: '',
        delivery_date: '',
        delivery_time: '',
        ratecon: false,
        pod: false
      })
    }
    setErrors({})
  }, [load, mode, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.load_number.trim()) newErrors.load_number = 'Load number is required'
    if (!formData.pickup_location.trim()) newErrors.pickup_location = 'Pickup location is required'
    if (!formData.delivery_location.trim()) newErrors.delivery_location = 'Delivery location is required'
    if (!formData.customer.name) newErrors.customer = 'Customer is required'
    if (!formData.driver) newErrors.driver = 'Driver is required'
    if (!formData.pickup_date) newErrors.pickup_date = 'Pickup date is required'
    if (!formData.pickup_time) newErrors.pickup_time = 'Pickup time is required'
    if (!formData.delivery_date) newErrors.delivery_date = 'Delivery date is required'
    if (!formData.delivery_time) newErrors.delivery_time = 'Delivery time is required'
    if (formData.rate <= 0) newErrors.rate = 'Rate must be greater than 0'
    if (formData.miles <= 0) newErrors.miles = 'Miles must be greater than 0'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
      onClose()
    }
  }

  const handleCustomerChange = (customerName: string) => {
    const selectedCustomer = customers.find(c => c.name === customerName)
    if (selectedCustomer) {
      setFormData({ ...formData, customer: selectedCustomer })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Load' : 'Edit Load'}
          </DialogTitle>
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
            <Select value={formData.status} onValueChange={(value: 'assigned' | 'in_transit' | 'delivered') =>
              setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={formData.customer.name} onValueChange={handleCustomerChange}>
              <SelectTrigger className={errors.customer ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.name} value={customer.name}>
                    {customer.name} ({customer.mc})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer && <p className="text-sm text-red-500">{errors.customer}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver">Driver</Label>
            <Select value={formData.driver} onValueChange={(value) =>
              setFormData({ ...formData, driver: value })}>
              <SelectTrigger className={errors.driver ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver} value={driver}>
                    {driver}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.driver && <p className="text-sm text-red-500">{errors.driver}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_location">Pickup Location</Label>
            <Input
              id="pickup_location"
              value={formData.pickup_location}
              onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
              className={errors.pickup_location ? 'border-red-500' : ''}
              placeholder="City, State"
            />
            {errors.pickup_location && <p className="text-sm text-red-500">{errors.pickup_location}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_location">Delivery Location</Label>
            <Input
              id="delivery_location"
              value={formData.delivery_location}
              onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })}
              className={errors.delivery_location ? 'border-red-500' : ''}
              placeholder="City, State"
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
              className={errors.pickup_date ? 'border-red-500' : ''}
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
              className={errors.pickup_time ? 'border-red-500' : ''}
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
              className={errors.delivery_date ? 'border-red-500' : ''}
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
              className={errors.delivery_time ? 'border-red-500' : ''}
            />
            {errors.delivery_time && <p className="text-sm text-red-500">{errors.delivery_time}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Rate ($)</Label>
            <Input
              id="rate"
              type="number"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
              className={errors.rate ? 'border-red-500' : ''}
              placeholder="0.00"
            />
            {errors.rate && <p className="text-sm text-red-500">{errors.rate}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="miles">Miles</Label>
            <Input
              id="miles"
              type="number"
              value={formData.miles}
              onChange={(e) => setFormData({ ...formData, miles: parseInt(e.target.value) || 0 })}
              className={errors.miles ? 'border-red-500' : ''}
              placeholder="0"
            />
            {errors.miles && <p className="text-sm text-red-500">{errors.miles}</p>}
          </div>
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