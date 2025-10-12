'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { useReceivers, useCreateReceiver, useUpdateReceiver, useDeleteReceiver } from '@/hooks/use-receivers'
import { Receiver } from '@/types'
import toast from 'react-hot-toast'

interface EditableReceiver extends Receiver {
  isNew?: boolean
}

type EditingCell = {
  receiverId: number | 'new'
  field: string
} | null

export default function ReceiversPage() {
  const { data: receiversData, isLoading, refetch } = useReceivers(1, 1000)
  const receivers = receiversData?.items || []
  const createReceiver = useCreateReceiver()
  const updateReceiver = useUpdateReceiver()
  const deleteReceiver = useDeleteReceiver()

  const [editableReceivers, setEditableReceivers] = useState<EditableReceiver[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  // Sync receivers with editable state
  React.useEffect(() => {
    const receiverIds = receivers.map(s => s.id).sort().join(',')
    const editableIds = editableReceivers.map(s => s.id).sort().join(',')

    if (receiverIds !== editableIds) {
      setEditableReceivers(receivers)
    }
  }, [receivers, receivers.length, editableReceivers])

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
      const result = await createReceiver.mutateAsync(backendData)
      setEditableReceivers([...editableReceivers, result])
      refetch()
    } catch (error: any) {
      console.error('Failed to create receiver:', error)
      alert(`Failed to create receiver: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this receiver?')) return

    try {
      await deleteReceiver.mutateAsync(id)
      setEditableReceivers(editableReceivers.filter(s => s.id !== id))
    } catch (error: any) {
      console.error('Failed to delete receiver:', error)
      toast.error(`Failed to delete receiver: ${error.response?.data?.detail || error.message}`)
    }
  }

  const updateField = async (id: number | 'new', field: keyof EditableReceiver, value: any) => {
    const updatedReceivers = editableReceivers.map(receiver => {
      if ((id === 'new' && receiver.isNew) || receiver.id === id) {
        return { ...receiver, [field]: value }
      }
      return receiver
    })
    setEditableReceivers(updatedReceivers)

    // Auto-save to backend if not a new receiver
    const receiver = updatedReceivers.find(s => (id === 'new' && s.isNew) || s.id === id)
    if (receiver && !receiver.isNew) {
      const backendData: any = {
        name: receiver.name,
        address: receiver.address || '',
        city: receiver.city || '',
        state: receiver.state || '',
        zip_code: receiver.zip_code || '',
        phone: receiver.phone || '',
        contact_person: receiver.contact_person || '',
        email: receiver.email || '',
        product_type: receiver.product_type || '',
        average_wait_time: receiver.average_wait_time || '',
        appointment_type: receiver.appointment_type || '',
        notes: receiver.notes || ''
      }
      await updateReceiver.mutateAsync({ id: receiver.id, data: backendData })
    }
  }

  const isEditing = (receiverId: number | 'new', field: string) => {
    return editingCell?.receiverId === receiverId && editingCell?.field === field
  }

  const startEdit = (receiverId: number | 'new', field: string) => {
    setEditingCell({ receiverId, field })
  }

  const stopEdit = () => {
    setEditingCell(null)
  }

  const renderReceiverRow = (receiver: EditableReceiver, rowIndex: number) => {
    const receiverKey = receiver.isNew ? 'new' : receiver.id
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    return (
      <tr
        key={receiverKey}
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
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'name')}>
          {isEditing(receiverKey, 'name') ? (
            <Input
              value={receiver.name}
              onChange={(e) => updateField(receiverKey, 'name', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.name || 'Untitled'}
            </div>
          )}
        </td>

        {/* Address */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'address')}>
          {isEditing(receiverKey, 'address') ? (
            <Input
              value={receiver.address || ''}
              onChange={(e) => updateField(receiverKey, 'address', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.address || 'N/A'}
            </div>
          )}
        </td>

        {/* City */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'city')}>
          {isEditing(receiverKey, 'city') ? (
            <Input
              value={receiver.city || ''}
              onChange={(e) => updateField(receiverKey, 'city', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.city || 'N/A'}
            </div>
          )}
        </td>

        {/* State */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'state')}>
          {isEditing(receiverKey, 'state') ? (
            <Input
              value={receiver.state || ''}
              onChange={(e) => updateField(receiverKey, 'state', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.state || 'N/A'}
            </div>
          )}
        </td>

        {/* Phone */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'phone')}>
          {isEditing(receiverKey, 'phone') ? (
            <Input
              value={receiver.phone || ''}
              onChange={(e) => updateField(receiverKey, 'phone', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.phone || 'N/A'}
            </div>
          )}
        </td>

        {/* Contact Person */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'contact_person')}>
          {isEditing(receiverKey, 'contact_person') ? (
            <Input
              value={receiver.contact_person || ''}
              onChange={(e) => updateField(receiverKey, 'contact_person', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.contact_person || 'N/A'}
            </div>
          )}
        </td>

        {/* Product Type */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'product_type')}>
          {isEditing(receiverKey, 'product_type') ? (
            <Input
              value={receiver.product_type || ''}
              onChange={(e) => updateField(receiverKey, 'product_type', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.product_type || 'N/A'}
            </div>
          )}
        </td>

        {/* Average Wait Time */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'average_wait_time')}>
          {isEditing(receiverKey, 'average_wait_time') ? (
            <Input
              value={receiver.average_wait_time || ''}
              onChange={(e) => updateField(receiverKey, 'average_wait_time', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="e.g., 30 mins"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.average_wait_time || 'N/A'}
            </div>
          )}
        </td>

        {/* Appointment Type */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(receiverKey, 'appointment_type')}>
          {isEditing(receiverKey, 'appointment_type') ? (
            <Input
              value={receiver.appointment_type || ''}
              onChange={(e) => updateField(receiverKey, 'appointment_type', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="e.g., Required"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {receiver.appointment_type || 'N/A'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{borderColor: 'var(--cell-borderColor)'}}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(receiver.id)}
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
            <h1 className="text-2xl font-semibold text-gray-900">Receivers</h1>
            <p className="text-gray-600">Manage delivery and receiving location information</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleAddNew}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Receiver
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
                {editableReceivers.map((receiver, index) => renderReceiverRow(receiver, index))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
