'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import { useRatecons, useCreateRatecon, useUpdateRatecon, useDeleteRatecon } from '@/hooks/use-ratecons'
import { Ratecon } from '@/types'
import toast from 'react-hot-toast'

interface EditableRatecon extends Ratecon {
  isNew?: boolean
}

type EditingCell = {
  rateconId: number | 'new'
  field: string
} | null

export default function RateconsPage() {
  const { data: rateconsData, isLoading, refetch } = useRatecons(1, 1000)
  const ratecons = rateconsData?.items || []
  const createRatecon = useCreateRatecon()
  const updateRatecon = useUpdateRatecon()
  const deleteRatecon = useDeleteRatecon()

  const [editableRatecons, setEditableRatecons] = useState<EditableRatecon[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  // Sync ratecons with editable state
  React.useEffect(() => {
    const rateconIds = ratecons.map(r => r.id).sort().join(',')
    const editableIds = editableRatecons.map(r => r.id).sort().join(',')

    if (rateconIds !== editableIds) {
      setEditableRatecons(ratecons)
    }
  }, [ratecons, ratecons.length, editableRatecons])

  const handleAddNew = async () => {
    const backendData: any = {
      ratecon_number: '',
      broker_name: '',
      load_number: null,
      carrier_name: null,
      date_issued: new Date().toISOString().split('T')[0],
      pickup_date: null,
      delivery_date: null,
      pickup_location: null,
      delivery_location: null,
      total_rate: 0,
      fuel_surcharge: 0,
      detention_rate: 0,
      layover_rate: 0,
      commodity: null,
      weight: 0,
      pieces: 0,
      equipment_type: null,
      broker_contact: null,
      broker_phone: null,
      broker_email: null,
      payment_terms: null,
      special_instructions: null,
      notes: null,
      status: 'pending',
      document_url: null
    }

    try {
      const result = await createRatecon.mutateAsync(backendData)
      setEditableRatecons([...editableRatecons, result])
      refetch()
    } catch (error: any) {
      console.error('Failed to create ratecon:', error)
      alert(`Failed to create ratecon: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ratecon?')) return

    try {
      await deleteRatecon.mutateAsync(id)
      setEditableRatecons(editableRatecons.filter(r => r.id !== id))
    } catch (error: any) {
      console.error('Failed to delete ratecon:', error)
      toast.error(`Failed to delete ratecon: ${error.response?.data?.detail || error.message}`)
    }
  }

  const updateField = async (id: number | 'new', field: keyof EditableRatecon, value: any) => {
    const updatedRatecons = editableRatecons.map(ratecon => {
      if ((id === 'new' && ratecon.isNew) || ratecon.id === id) {
        return { ...ratecon, [field]: value }
      }
      return ratecon
    })
    setEditableRatecons(updatedRatecons)

    // Auto-save to backend if not a new ratecon
    const ratecon = updatedRatecons.find(r => (id === 'new' && r.isNew) || r.id === id)
    if (ratecon && !ratecon.isNew) {
      const backendData: any = {
        ratecon_number: ratecon.ratecon_number,
        broker_name: ratecon.broker_name,
        load_number: ratecon.load_number || null,
        carrier_name: ratecon.carrier_name || null,
        date_issued: ratecon.date_issued || null,
        pickup_date: ratecon.pickup_date || null,
        delivery_date: ratecon.delivery_date || null,
        pickup_location: ratecon.pickup_location || null,
        delivery_location: ratecon.delivery_location || null,
        total_rate: ratecon.total_rate || 0,
        fuel_surcharge: ratecon.fuel_surcharge || 0,
        detention_rate: ratecon.detention_rate || 0,
        layover_rate: ratecon.layover_rate || 0,
        commodity: ratecon.commodity || null,
        weight: ratecon.weight || 0,
        pieces: ratecon.pieces || 0,
        equipment_type: ratecon.equipment_type || null,
        broker_contact: ratecon.broker_contact || null,
        broker_phone: ratecon.broker_phone || null,
        broker_email: ratecon.broker_email || null,
        payment_terms: ratecon.payment_terms || null,
        special_instructions: ratecon.special_instructions || null,
        notes: ratecon.notes || null,
        status: ratecon.status || 'pending',
        document_url: ratecon.document_url || null
      }
      await updateRatecon.mutateAsync({ id: ratecon.id, data: backendData })
    }
  }

  const isEditing = (rateconId: number | 'new', field: string) => {
    return editingCell?.rateconId === rateconId && editingCell?.field === field
  }

  const startEdit = (rateconId: number | 'new', field: string) => {
    setEditingCell({ rateconId, field })
  }

  const stopEdit = () => {
    setEditingCell(null)
  }

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return ''
    return dateString.split('T')[0]
  }

  const renderRateconRow = (ratecon: EditableRatecon, rowIndex: number) => {
    const rateconKey = ratecon.isNew ? 'new' : ratecon.id
    const isEvenRow = rowIndex % 2 === 0
    const defaultBgColor = isEvenRow ? 'var(--cell-background-base)' : 'rgba(0, 0, 0, 0.02)'

    return (
      <tr
        key={rateconKey}
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
        {/* Ratecon # */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'ratecon_number')}>
          {isEditing(rateconKey, 'ratecon_number') ? (
            <Input
              value={ratecon.ratecon_number}
              onChange={(e) => updateField(rateconKey, 'ratecon_number', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.ratecon_number || 'Untitled'}
            </div>
          )}
        </td>

        {/* Load # */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'load_number')}>
          {isEditing(rateconKey, 'load_number') ? (
            <Input
              value={ratecon.load_number || ''}
              onChange={(e) => updateField(rateconKey, 'load_number', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.load_number || 'N/A'}
            </div>
          )}
        </td>

        {/* Broker Name */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'broker_name')}>
          {isEditing(rateconKey, 'broker_name') ? (
            <Input
              value={ratecon.broker_name}
              onChange={(e) => updateField(rateconKey, 'broker_name', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.broker_name || 'N/A'}
            </div>
          )}
        </td>

        {/* Pickup Location */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'pickup_location')}>
          {isEditing(rateconKey, 'pickup_location') ? (
            <Input
              value={ratecon.pickup_location || ''}
              onChange={(e) => updateField(rateconKey, 'pickup_location', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.pickup_location || 'N/A'}
            </div>
          )}
        </td>

        {/* Delivery Location */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'delivery_location')}>
          {isEditing(rateconKey, 'delivery_location') ? (
            <Input
              value={ratecon.delivery_location || ''}
              onChange={(e) => updateField(rateconKey, 'delivery_location', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.delivery_location || 'N/A'}
            </div>
          )}
        </td>

        {/* Total Rate */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'total_rate')}>
          {isEditing(rateconKey, 'total_rate') ? (
            <Input
              type="number"
              value={ratecon.total_rate || 0}
              onChange={(e) => updateField(rateconKey, 'total_rate', Number(e.target.value))}
              onBlur={stopEdit}
              autoFocus
              className="h-8 text-sm text-right"
            />
          ) : (
            <div className="font-medium cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5 text-right" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {formatCurrency(ratecon.total_rate || 0)}
            </div>
          )}
        </td>

        {/* Payment Terms */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'payment_terms')}>
          {isEditing(rateconKey, 'payment_terms') ? (
            <Input
              value={ratecon.payment_terms || ''}
              onChange={(e) => updateField(rateconKey, 'payment_terms', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="Net 30"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.payment_terms || 'N/A'}
            </div>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5 border-r" style={{borderColor: 'var(--cell-borderColor)'}} onClick={() => startEdit(rateconKey, 'status')}>
          {isEditing(rateconKey, 'status') ? (
            <Input
              value={ratecon.status || 'pending'}
              onChange={(e) => updateField(rateconKey, 'status', e.target.value)}
              onBlur={stopEdit}
              autoFocus
              placeholder="pending"
              className="h-8 text-sm"
            />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1.5 py-0.5" style={{fontSize: '13px', lineHeight: '18px', color: 'var(--colors-foreground-default)'}}>
              {ratecon.status || 'pending'}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5" style={{borderColor: 'var(--cell-borderColor)'}}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(ratecon.id)}
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
            <h1 className="text-2xl font-semibold text-gray-900">Rate Confirmations</h1>
            <p className="text-gray-600">Manage rate confirmations and pricing agreements</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleAddNew}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Ratecon
          </Button>
        </div>

        <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{borderColor: 'var(--cell-borderColor)'}}>
          <div className="overflow-x-auto">
            <table className="w-full table-auto" style={{borderCollapse: 'separate', borderSpacing: 0}}>
              <thead style={{backgroundColor: 'var(--cell-background-header)'}}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Ratecon #</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Load #</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Broker</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Pickup</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Delivery</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Rate</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Payment Terms</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium border-b" style={{color: 'var(--colors-foreground-muted)', borderColor: 'var(--cell-borderColor-header)', fontWeight: 500}}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white" style={{backgroundColor: 'var(--cell-background-base)'}}>
                {editableRatecons.map((ratecon, index) => renderRateconRow(ratecon, index))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
