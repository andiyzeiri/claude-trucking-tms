'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface InvoiceData {
  id?: number
  invoice_number: string
  customer: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  issue_date: string
  due_date: string
  loads: string[]
}

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (invoice: InvoiceData) => void
  invoice?: InvoiceData | null
  mode: 'create' | 'edit'
}

const customers = ['ABC Logistics', 'XYZ Shipping', 'Global Transport', 'Fast Freight', 'Prime Logistics']
const availableLoads = ['TMS001', 'TMS002', 'TMS003', 'TMS004', 'TMS005', 'TMS006', 'TMS007']

export function InvoiceModal({ isOpen, onClose, onSave, invoice, mode }: InvoiceModalProps) {
  const [formData, setFormData] = useState<InvoiceData>({
    invoice_number: '',
    customer: '',
    amount: 0,
    status: 'pending',
    issue_date: '',
    due_date: '',
    loads: []
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedLoad, setSelectedLoad] = useState('')

  useEffect(() => {
    if (invoice && mode === 'edit') {
      setFormData(invoice)
    } else if (mode === 'create') {
      const today = new Date().toISOString().split('T')[0]
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      setFormData({
        invoice_number: `INV-${String(Date.now()).slice(-3)}`,
        customer: '',
        amount: 0,
        status: 'pending',
        issue_date: today,
        due_date: dueDate.toISOString().split('T')[0],
        loads: []
      })
    }
    setErrors({})
    setSelectedLoad('')
  }, [invoice, mode, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.invoice_number.trim()) newErrors.invoice_number = 'Invoice number is required'
    if (!formData.customer) newErrors.customer = 'Customer is required'
    if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'
    if (!formData.issue_date) newErrors.issue_date = 'Issue date is required'
    if (!formData.due_date) newErrors.due_date = 'Due date is required'
    if (formData.loads.length === 0) newErrors.loads = 'At least one load is required'

    // Validate due date is after issue date
    if (formData.issue_date && formData.due_date && formData.due_date <= formData.issue_date) {
      newErrors.due_date = 'Due date must be after issue date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
      onClose()
    }
  }

  const addLoad = () => {
    if (selectedLoad && !formData.loads.includes(selectedLoad)) {
      setFormData({
        ...formData,
        loads: [...formData.loads, selectedLoad]
      })
      setSelectedLoad('')
    }
  }

  const removeLoad = (loadToRemove: string) => {
    setFormData({
      ...formData,
      loads: formData.loads.filter(load => load !== loadToRemove)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Invoice' : 'Edit Invoice'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              id="invoice_number"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              className={errors.invoice_number ? 'border-red-500' : ''}
            />
            {errors.invoice_number && <p className="text-sm text-red-500">{errors.invoice_number}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: 'paid' | 'pending' | 'overdue') =>
              setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={formData.customer} onValueChange={(value) => setFormData({ ...formData, customer: value })}>
              <SelectTrigger className={errors.customer ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer && <p className="text-sm text-red-500">{errors.customer}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className={errors.amount ? 'border-red-500' : ''}
              placeholder="0.00"
            />
            {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue_date">Issue Date</Label>
            <Input
              id="issue_date"
              type="date"
              value={formData.issue_date}
              onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              className={errors.issue_date ? 'border-red-500' : ''}
            />
            {errors.issue_date && <p className="text-sm text-red-500">{errors.issue_date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className={errors.due_date ? 'border-red-500' : ''}
            />
            {errors.due_date && <p className="text-sm text-red-500">{errors.due_date}</p>}
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Associated Loads</Label>
            <div className="flex gap-2">
              <Select value={selectedLoad} onValueChange={setSelectedLoad}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a load to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableLoads
                    .filter(load => !formData.loads.includes(load))
                    .map((load) => (
                      <SelectItem key={load} value={load}>
                        {load}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addLoad} disabled={!selectedLoad}>
                Add
              </Button>
            </div>

            {formData.loads.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.loads.map((load) => (
                  <div key={load} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                    <span>{load}</span>
                    <button
                      type="button"
                      onClick={() => removeLoad(load)}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.loads && <p className="text-sm text-red-500">{errors.loads}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Invoice' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}