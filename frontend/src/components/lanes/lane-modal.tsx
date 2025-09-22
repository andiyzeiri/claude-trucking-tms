'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

export interface LaneData {
  id?: number
  pickup_location: string
  delivery_location: string
  broker: string
  email: string
  phone: string
  notes?: string
}

interface LaneModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (lane: LaneData) => void
  lane: LaneData | null
  mode: 'create' | 'edit'
}

export function LaneModal({ isOpen, onClose, onSave, lane, mode }: LaneModalProps) {
  const [formData, setFormData] = useState<LaneData>({
    pickup_location: '',
    delivery_location: '',
    broker: '',
    email: '',
    phone: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      if (lane) {
        setFormData({ ...lane })
      } else {
        setFormData({
          pickup_location: '',
          delivery_location: '',
          broker: '',
          email: '',
          phone: '',
          notes: ''
        })
      }
      setErrors({})
    }
  }, [isOpen, lane])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.pickup_location.trim()) {
      newErrors.pickup_location = 'Pickup location is required'
    }

    if (!formData.delivery_location.trim()) {
      newErrors.delivery_location = 'Delivery location is required'
    }

    if (!formData.broker.trim()) {
      newErrors.broker = 'Broker name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
      onClose()
    }
  }

  const handleChange = (field: keyof LaneData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add New Lane' : 'Edit Lane'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="pickup_location">Pickup Location *</Label>
              <Input
                id="pickup_location"
                type="text"
                value={formData.pickup_location}
                onChange={(e) => handleChange('pickup_location', e.target.value)}
                className={errors.pickup_location ? 'border-red-300' : ''}
                placeholder="e.g., Los Angeles, CA"
              />
              {errors.pickup_location && (
                <p className="text-red-500 text-sm mt-1">{errors.pickup_location}</p>
              )}
            </div>

            <div>
              <Label htmlFor="delivery_location">Delivery Location *</Label>
              <Input
                id="delivery_location"
                type="text"
                value={formData.delivery_location}
                onChange={(e) => handleChange('delivery_location', e.target.value)}
                className={errors.delivery_location ? 'border-red-300' : ''}
                placeholder="e.g., Phoenix, AZ"
              />
              {errors.delivery_location && (
                <p className="text-red-500 text-sm mt-1">{errors.delivery_location}</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="broker">Broker Company *</Label>
            <Input
              id="broker"
              type="text"
              value={formData.broker}
              onChange={(e) => handleChange('broker', e.target.value)}
              className={errors.broker ? 'border-red-300' : ''}
              placeholder="e.g., ABC Logistics LLC"
            />
            {errors.broker && (
              <p className="text-red-500 text-sm mt-1">{errors.broker}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={errors.email ? 'border-red-300' : ''}
                placeholder="dispatch@company.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={errors.phone ? 'border-red-300' : ''}
                placeholder="(555) 123-4567"
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              type="text"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Optional notes about this lane..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {mode === 'create' ? 'Create Lane' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}