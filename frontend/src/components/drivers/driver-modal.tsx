'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'

export interface DriverData {
  id?: number
  first_name: string
  last_name: string
  license_number: string
  phone: string
  email: string
  status: 'available' | 'on_trip' | 'off_duty'
  driver_type: 'company' | 'owner_operator'
  date_hired?: string
  date_terminated?: string
  date_of_birth?: string
  experience?: string
  mvr_expiry?: string
  medical_card_expiry?: string
  has_fuel_card?: boolean
  fuel_card_number?: string
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
    status: 'available',
    driver_type: 'company',
    date_hired: '',
    date_terminated: '',
    date_of_birth: '',
    experience: '',
    mvr_expiry: '',
    medical_card_expiry: '',
    has_fuel_card: false,
    fuel_card_number: ''
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
        driver_type: 'company',
        date_hired: '',
        date_terminated: '',
        date_of_birth: '',
        experience: '',
        mvr_expiry: '',
        medical_card_expiry: '',
        has_fuel_card: false,
        fuel_card_number: '',
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

          <div className="space-y-2">
            <Label htmlFor="driver_type">Driver Type</Label>
            <Select value={formData.driver_type} onValueChange={(value: 'company' | 'owner_operator') =>
              setFormData({ ...formData, driver_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company Driver</SelectItem>
                <SelectItem value="owner_operator">Owner Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date Hired</Label>
            <DatePicker
              value={formData.date_hired || ''}
              onChange={(date) => setFormData({ ...formData, date_hired: date })}
              placeholder="Select hire date"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-red-600">Date Terminated</Label>
            <DatePicker
              value={formData.date_terminated || ''}
              onChange={(date) => setFormData({ ...formData, date_terminated: date })}
              placeholder="Select termination date"
              className={formData.date_terminated ? 'border-red-300 bg-red-50' : ''}
            />
            {formData.date_terminated && (
              <p className="text-xs text-red-500">Driver will not appear on dispatch board</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <DatePicker
              value={formData.date_of_birth || ''}
              onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
              placeholder="Select birth date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience">Experience</Label>
            <Input
              id="experience"
              value={formData.experience || ''}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="5 years"
            />
          </div>

          <div className="space-y-2">
            <Label>MVR Expiry</Label>
            <DatePicker
              value={formData.mvr_expiry || ''}
              onChange={(date) => setFormData({ ...formData, mvr_expiry: date })}
              placeholder="Select MVR expiry"
            />
          </div>

          <div className="space-y-2">
            <Label>Medical Card Expiry</Label>
            <DatePicker
              value={formData.medical_card_expiry || ''}
              onChange={(date) => setFormData({ ...formData, medical_card_expiry: date })}
              placeholder="Select medical card expiry"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="has_fuel_card" className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has_fuel_card"
                checked={formData.has_fuel_card || false}
                onChange={(e) => setFormData({ ...formData, has_fuel_card: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Has Fuel Card
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel_card_number">Fuel Card Number</Label>
            <Input
              id="fuel_card_number"
              value={formData.fuel_card_number || ''}
              onChange={(e) => setFormData({ ...formData, fuel_card_number: e.target.value })}
              placeholder="Enter fuel card number"
              disabled={!formData.has_fuel_card}
              className={!formData.has_fuel_card ? 'bg-gray-100' : ''}
            />
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