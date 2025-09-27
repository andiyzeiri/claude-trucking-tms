'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

// Helper function to generate week options
const generateWeekOptions = () => {
  const weeks = []

  // Set first week to start on December 30, 2024
  const firstWeekStart = new Date(2024, 11, 30) // December 30, 2024

  for (let i = 1; i <= 52; i++) {
    const weekStart = new Date(firstWeekStart)
    weekStart.setDate(firstWeekStart.getDate() + (i - 1) * 7)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || `Start-${i}`
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || `End-${i}`

    const weekValue = `Week ${i} (${startStr} - ${endStr})`

    // Ensure we never push empty or undefined values
    if (weekValue && weekValue.trim() !== '') {
      weeks.push({
        value: weekValue,
        label: weekValue
      })
    }
  }

  return weeks
}

export interface PayrollData {
  id?: number
  week: string
  driver: string
  type: 'company' | 'owner_operator'
  gross: number
  dispatch_fee: number
  insurance: number
  fuel: number
  parking: number
  trailer: number
  misc: number
  miles: number
  check: number
  rpm: number
  escrow: number
}

interface PayrollModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payroll: PayrollData) => void
  payroll?: PayrollData | null
  mode: 'create' | 'edit'
}

export function PayrollModal({ isOpen, onClose, onSave, payroll, mode }: PayrollModalProps) {
  const [formData, setFormData] = useState<PayrollData>({
    week: '',
    driver: '',
    type: 'company',
    gross: 0,
    dispatch_fee: 0,
    insurance: 0,
    fuel: 0,
    parking: 0,
    trailer: 0,
    misc: 0,
    miles: 0,
    check: 0,
    rpm: 0,
    escrow: 0
  })

  useEffect(() => {
    if (payroll && mode === 'edit') {
      setFormData(payroll)
    } else {
      setFormData({
        week: '',
        driver: '',
        type: 'company',
        gross: 0,
        dispatch_fee: 0,
        insurance: 0,
        fuel: 0,
        parking: 0,
        trailer: 0,
        misc: 0,
        miles: 0,
        check: 0,
        rpm: 0,
        escrow: 0
      })
    }
  }, [payroll, mode, isOpen])

  // Calculate derived values
  useEffect(() => {
    const totalDeductions = formData.dispatch_fee + formData.insurance + formData.fuel +
                           formData.parking + formData.trailer + formData.misc
    const checkAmount = formData.gross - totalDeductions - formData.escrow
    const rpmValue = formData.miles > 0 ? formData.gross / formData.miles : 0

    setFormData(prev => ({
      ...prev,
      check: Math.max(0, checkAmount),
      rpm: rpmValue
    }))
  }, [formData.gross, formData.dispatch_fee, formData.insurance, formData.fuel,
      formData.parking, formData.trailer, formData.misc, formData.escrow, formData.miles])

  const handleInputChange = (field: keyof PayrollData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? value : Number(value)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create New Payroll Entry' : 'Edit Payroll Entry'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Driver Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Driver Information</h3>

              <div>
                <Label htmlFor="week">Week</Label>
                <Select
                  value={formData.week}
                  onValueChange={(value: string) => handleInputChange('week', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateWeekOptions().map((week, index) => {
                      const safeValue = week.value && week.value.trim() !== '' ? week.value : `week-option-${index + 1}`
                      return (
                        <SelectItem key={`week-${index + 1}`} value={safeValue}>
                          {week.label || `Week ${index + 1}`}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="driver">Driver Name</Label>
                <Input
                  id="driver"
                  type="text"
                  value={formData.driver}
                  onChange={(e) => handleInputChange('driver', e.target.value)}
                  placeholder="Enter driver name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Driver Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'company' | 'owner_operator') => handleInputChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company Driver</SelectItem>
                    <SelectItem value="owner_operator">Owner Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="miles">Miles</Label>
                <Input
                  id="miles"
                  type="number"
                  value={formData.miles}
                  onChange={(e) => handleInputChange('miles', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            {/* Financial Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Financial Details</h3>

              <div>
                <Label htmlFor="gross">Gross Amount</Label>
                <Input
                  id="gross"
                  type="number"
                  value={formData.gross}
                  onChange={(e) => handleInputChange('gross', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="dispatch_fee">Dispatch Fee</Label>
                <Input
                  id="dispatch_fee"
                  type="number"
                  value={formData.dispatch_fee}
                  onChange={(e) => handleInputChange('dispatch_fee', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="insurance">Insurance</Label>
                <Input
                  id="insurance"
                  type="number"
                  value={formData.insurance}
                  onChange={(e) => handleInputChange('insurance', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="fuel">Fuel</Label>
                <Input
                  id="fuel"
                  type="number"
                  value={formData.fuel}
                  onChange={(e) => handleInputChange('fuel', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Additional Costs & Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Additional Costs</h3>

              <div>
                <Label htmlFor="parking">Parking</Label>
                <Input
                  id="parking"
                  type="number"
                  value={formData.parking}
                  onChange={(e) => handleInputChange('parking', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="trailer">Trailer</Label>
                <Input
                  id="trailer"
                  type="number"
                  value={formData.trailer}
                  onChange={(e) => handleInputChange('trailer', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="misc">Miscellaneous</Label>
                <Input
                  id="misc"
                  type="number"
                  value={formData.misc}
                  onChange={(e) => handleInputChange('misc', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="escrow">Escrow</Label>
                <Input
                  id="escrow"
                  type="number"
                  value={formData.escrow}
                  onChange={(e) => handleInputChange('escrow', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Calculated Results */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Calculated Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Final Check Amount:</span>
                <span className="text-lg font-bold text-green-600">
                  ${formData.check.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Revenue Per Mile (RPM):</span>
                <span className="text-lg font-bold text-blue-600">
                  ${formData.rpm.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
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
              {mode === 'create' ? 'Create Payroll Entry' : 'Update Payroll Entry'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}