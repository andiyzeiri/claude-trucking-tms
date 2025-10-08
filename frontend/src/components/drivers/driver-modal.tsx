'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface DriverData {
  id?: number
  first_name: string
  last_name: string
  license_number: string
  phone: string
  email: string
  status: 'available' | 'on_trip' | 'off_duty'
  created_at?: string
}

interface DriverModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (driver: DriverData) => void
  driver?: DriverData | null
  mode: 'create' | 'edit'
}

export function DriverModal({ isOpen, onClose, onSave, driver, mode }: DriverModalProps) {
  const [formData, setFormData] = useState<DriverData>({
    first_name: '',
    last_name: '',
    license_number: '',
    phone: '',
    email: '',
    status: 'available'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (driver && mode === 'edit') {
      setFormData(driver)
    } else if (mode === 'create') {
      setFormData({
        first_name: '',
        last_name: '',
        license_number: `CDL${String(Date.now()).slice(-6)}`,
        phone: '',
        email: '',
        status: 'available',
        created_at: new Date().toISOString()
      })
    }
    setErrors({})
  }, [driver, mode, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required'
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required'
    if (!formData.license_number.trim()) newErrors.license_number = 'License number is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'

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
            {mode === 'create' ? 'Add New Driver' : 'Edit Driver'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => {
                const value = e.target.value
                const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
                setFormData({ ...formData, first_name: capitalized })
              }}
              className={errors.first_name ? 'border-red-500' : ''}
              placeholder="John"
            />
            {errors.first_name && <p className="text-sm text-red-500">{errors.first_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => {
                const value = e.target.value
                const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
                setFormData({ ...formData, last_name: capitalized })
              }}
              className={errors.last_name ? 'border-red-500' : ''}
              placeholder="Smith"
            />
            {errors.last_name && <p className="text-sm text-red-500">{errors.last_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_number">CDL License Number</Label>
            <Input
              id="license_number"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              className={errors.license_number ? 'border-red-500' : ''}
              placeholder="CDL123456"
            />
            {errors.license_number && <p className="text-sm text-red-500">{errors.license_number}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Remove non-digits
                let formatted = value
                if (value.length >= 1) {
                  formatted = `(${value.slice(0, 3)}`
                }
                if (value.length >= 4) {
                  formatted = `(${value.slice(0, 3)}) ${value.slice(3, 6)}`
                }
                if (value.length >= 7) {
                  formatted = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`
                }
                setFormData({ ...formData, phone: formatted })
              }}
              className={errors.phone ? 'border-red-500' : ''}
              placeholder="(847) 436-1677"
              maxLength={14}
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={errors.email ? 'border-red-500' : ''}
              placeholder="john@example.com"
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: 'available' | 'on_trip' | 'off_duty') =>
              setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="on_trip">On Trip</SelectItem>
                <SelectItem value="off_duty">Off Duty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Add Driver' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}