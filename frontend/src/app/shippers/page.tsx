'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { useShippers, useCreateShipper, useUpdateShipper, useDeleteShipper } from '@/hooks/use-shippers'
import { Shipper } from '@/types'
import toast from 'react-hot-toast'

interface EditableShipper extends Shipper {
  isNew?: boolean
}

type EditingCell = {
  shipperId: number | 'new'
  field: string
} | null

export default function ShippersPage() {
  const { data: shippersData, isLoading, refetch } = useShippers(1, 1000)
  const shippers = shippersData?.items || []
  const createShipper = useCreateShipper()
  const updateShipper = useUpdateShipper()
  const deleteShipper = useDeleteShipper()

  const [editableShippers, setEditableShippers] = useState<EditableShipper[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  // Sync shippers with editable state
  React.useEffect(() => {
    const shipperIds = shippers.map(s => s.id).sort().join(',')
    const editableIds = editableShippers.map(s => s.id).sort().join(',')

    if (shipperIds !== editableIds) {
      setEditableShippers(shippers)
    }
  }, [shippers, shippers.length, editableShippers])

  const handleAddNew = async () => {
    const backendData: any = {
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      phone: '',
      contact_person: '',
      email: '',
      product_type: '',
      average_wait_time: '',
      appointment_type: '',
      notes: ''
    }

    try {
      const result = await createShipper.mutateAsync(backendData)
      setEditableShippers([...editableShippers, result])
      refetch()
    } catch (error: any) {
      console.error('Failed to create shipper:', error)
      alert(`Failed to create shipper: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this shipper?')) return

    try {
      await deleteShipper.mutateAsync(id)
      setEditableShippers(editableShippers.filter(s => s.id !== id))
    } catch (error: any) {
      console.error('Failed to delete shipper:', error)
      toast.error(`Failed to delete shipper: ${error.response?.data?.detail || error.message}`)
    }
  }

  const updateField = async (id: number | 'new', field: keyof EditableShipper, value: any) => {
    const updatedShippers = editableShippers.map(shipper => {
      if ((id === 'new' && shipper.isNew) || shipper.id === id) {
        return { ...shipper, [field]: value }
      }
      return shipper
    })
    setEditableShippers(updatedShippers)

    // Auto-save to backend if not a new shipper
    const shipper = updatedShippers.find(s => (id === 'new' && s.isNew) || s.id === id)
    if (shipper && !shipper.isNew) {
      const backendData: any = {
        name: shipper.name,
        address: shipper.address || '',
        city: shipper.city || '',
        state: shipper.state || '',
        zip_code: shipper.zip_code || '',
        phone: shipper.phone || '',
        contact_person: shipper.contact_person || '',
        email: shipper.email || '',
        product_type: shipper.product_type || '',
        average_wait_time: shipper.average_wait_time || '',
        appointment_type: shipper.appointment_type || '',
        notes: shipper.notes || ''
      }
      await updateShipper.mutateAsync({ id: shipper.id, data: backendData })
    }
  }

  const isEditing = (shipperId: number | 'new', field: string) => {
    return editingCell?.shipperId === shipperId && editingCell?.field === field
  }

  const startEdit = (shipperId: number | 'new', field: string) => {
    setEditingCell({ shipperId, field })
  }

  const stopEdit = () => {
    setEditingCell(null)
  }

  const renderShipperRow = (shipper: EditableShipper, rowIndex: number) => {
    const shipperKey = shipper.isNew ? 'new' : shipper.id
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    return (
      <tr
        key={shipperKey}
        className="border-b transition-colors"
        style={{
          borderColor: 'var(--cell-borderColor)',
          backgroundColor: defaultBgColor
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--row-background-cursor)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = defaultBgColor
        }}
      >
        {/* Name */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'name')}>
          {isEditing(shipperKey, 'name') ? (
            <Input
              value={shipper.name}
              onChange={(e) => updateField(shipperKey, 'name', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.name || 'Untitled'}
            </div>
          )}
        </td>

        {/* Address */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'address')}>
          {isEditing(shipperKey, 'address') ? (
            <Input
              value={shipper.address || ''}
              onChange={(e) => updateField(shipperKey, 'address', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.address || 'N/A'}
            </div>
          )}
        </td>

        {/* City */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'city')}>
          {isEditing(shipperKey, 'city') ? (
            <Input
              value={shipper.city || ''}
              onChange={(e) => updateField(shipperKey, 'city', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.city || 'N/A'}
            </div>
          )}
        </td>

        {/* State */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'state')}>
          {isEditing(shipperKey, 'state') ? (
            <Input
              value={shipper.state || ''}
              onChange={(e) => updateField(shipperKey, 'state', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.state || 'N/A'}
            </div>
          )}
        </td>

        {/* Phone */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'phone')}>
          {isEditing(shipperKey, 'phone') ? (
            <Input
              value={shipper.phone || ''}
              onChange={(e) => updateField(shipperKey, 'phone', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.phone || 'N/A'}
            </div>
          )}
        </td>

        {/* Contact Person */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'contact_person')}>
          {isEditing(shipperKey, 'contact_person') ? (
            <Input
              value={shipper.contact_person || ''}
              onChange={(e) => updateField(shipperKey, 'contact_person', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.contact_person || 'N/A'}
            </div>
          )}
        </td>

        {/* Product Type */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'product_type')}>
          {isEditing(shipperKey, 'product_type') ? (
            <Input
              value={shipper.product_type || ''}
              onChange={(e) => updateField(shipperKey, 'product_type', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.product_type || 'N/A'}
            </div>
          )}
        </td>

        {/* Average Wait Time */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'average_wait_time')}>
          {isEditing(shipperKey, 'average_wait_time') ? (
            <Input
              value={shipper.average_wait_time || ''}
              onChange={(e) => updateField(shipperKey, 'average_wait_time', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="e.g., 30 mins"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.average_wait_time || 'N/A'}
            </div>
          )}
        </td>

        {/* Appointment Type */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(shipperKey, 'appointment_type')}>
          {isEditing(shipperKey, 'appointment_type') ? (
            <Input
              value={shipper.appointment_type || ''}
              onChange={(e) => updateField(shipperKey, 'appointment_type', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="e.g., Required"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {shipper.appointment_type || 'N/A'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{borderColor: 'var(--cell-borderColor)'}}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(shipper.id)}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Shippers</h1>
            <p className="text-gray-600">Manage warehouse and shipping location information</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleAddNew}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Shipper
          </Button>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="overflow-x-auto">
            <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
              <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Address</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>City</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>State</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Phone</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Contact</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Product Type</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Avg Wait</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Appointment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white" style={{backgroundColor: 'var(--cell-background-base)'}}>
                {editableShippers.map((shipper, index) => renderShipperRow(shipper, index))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
