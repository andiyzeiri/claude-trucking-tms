'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { TruckModal, TruckData, TruckOwnership, STATUS_LABEL } from '@/components/trucks/truck-modal'
import { Plus, Truck as TruckIcon, Edit, Trash2, FileText, X } from 'lucide-react'
import { useTrucks, useCreateTruck, useUpdateTruck } from '@/hooks/use-trucks'
import { PdfViewer } from '@/components/loads/pdf-viewer'
import api from '@/lib/api'
import toast from 'react-hot-toast'

type DocField = 'registration_url' | 'inspection_url'
const DOC_LABEL: Record<DocField, string> = { registration_url: 'Registration', inspection_url: 'Inspection' }

// /api/v1/uploads/s3/... paths are served by the API host.
function fileUrl(path: string): string {
  if (path.startsWith('http')) return path
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.absolutetms.com/api'
  return `${apiUrl.replace('/api/v1', '').replace('/api', '')}${path}`
}

// Sold (company) and Not Leased (owner-operator) units are kept for history, at the bottom.
const INACTIVE = new Set(['sold', 'not_leased'])

export default function TrucksPage() {
  // Fetch trucks from API
  const { data: trucksData, isLoading } = useTrucks()
  const rawTrucks = trucksData?.items || []
  const createTruck = useCreateTruck()
  const updateTruck = useUpdateTruck()

  const trucks: any[] = rawTrucks
  const [tab, setTab] = useState<TruckOwnership>('company')
  const ownershipOf = (t: any): TruckOwnership => (t.ownership === 'owner_operator' ? 'owner_operator' : 'company')
  const counts = useMemo(() => ({
    company: trucks.filter(t => ownershipOf(t) === 'company').length,
    owner_operator: trucks.filter(t => ownershipOf(t) === 'owner_operator').length,
  }), [trucks])

  // This tab's trucks and trailers; within each, sold / not leased last
  const { trucksOnly, trailersOnly } = useMemo(() => {
    const mine = trucks.filter(t => ownershipOf(t) === tab)
    const order = (list: any[]) => [...list].sort((a, b) => Number(INACTIVE.has(a.status)) - Number(INACTIVE.has(b.status)))
    return {
      trucksOnly: order(mine.filter(t => (t.type || 'truck') === 'truck')),
      trailersOnly: order(mine.filter(t => t.type === 'trailer'))
    }
  }, [trucks, tab])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTruck, setEditingTruck] = useState<TruckData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof trucks[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })


  // CRUD operations
  const handleCreateTruck = () => {
    setEditingTruck(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEditTruck = (truck: typeof trucks[0]) => {
    const truckData: TruckData = {
      id: truck.id,
      type: truck.type || 'truck',
      unit_number: truck.truck_number || '',
      make: truck.make || '',
      model: truck.model || '',
      year: truck.year || new Date().getFullYear(),
      vin: truck.vin || '',
      value: Number(truck.value) || 0,
      miles: Number(truck.miles) || 0,
      odometer_at: truck.odometer_at || null,
      mpg: Number(truck.mpg) || 0,
      registration: '',
      inspection: '',
      status: truck.status,
      ownership: truck.ownership || 'company',
      driver: null
    }
    setEditingTruck(truckData)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteTruck = (truckId: number) => {
    if (confirm('Are you sure you want to delete this truck?')) {
      // TODO: Implement delete truck API call
      console.log('Delete truck:', truckId)
    }
  }

  const handleSaveTruck = (truckData: TruckData) => {
    const backendData = {
      type: truckData.type,
      truck_number: truckData.unit_number,
      make: truckData.make,
      model: truckData.model,
      year: truckData.year,
      vin: truckData.vin,
      status: truckData.status,
      ownership: truckData.ownership,
      value: truckData.value || 0,
      // Peak ELD keeps the miles of matched trucks; don't overwrite them from the form
      ...(truckData.odometer_at ? {} : { miles: truckData.miles || 0 }),
      mpg: truckData.mpg || 0
    }

    if (modalMode === 'create') {
      createTruck.mutate(backendData as any)
    } else if (editingTruck?.id) {
      updateTruck.mutate({ id: editingTruck.id, data: backendData as any })
    }
    setIsModalOpen(false)
  }

  // Context menu handlers
  const handleRowRightClick = (row: typeof trucks[0], event: React.MouseEvent) => {
    setContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      row
    })
  }

  const closeContextMenu = () => {
    setContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  }

  const handleContextEdit = () => {
    if (contextMenu.row) {
      handleEditTruck(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeleteTruck(contextMenu.row.id)
    }
    closeContextMenu()
  }


  // Registration / inspection documents: upload, view, replace, delete - like POD and ratecon
  const [docModal, setDocModal] = useState<{ truckId: number; field: DocField; url: string; label: string } | null>(null)
  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, truckId: number, field: DocField) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/\.(pdf|jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)) {
      toast.error('Upload a PDF or a photo (JPG, PNG, HEIC)')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    const t = toast.loading('Uploading...')
    try {
      const res = await api.post('/v1/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await updateTruck.mutateAsync({ id: truckId, data: { [field]: res.data.url } as any })
      toast.success(`${DOC_LABEL[field]} uploaded`, { id: t })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: t })
    }
  }
  const docCell = (item: any, field: DocField) => {
    const url: string | null = item[field]
    const inputId = `${field}-${item.id}`
    return (
      <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {url && (
            <button
              onClick={() => setDocModal({ truckId: item.id, field, url: fileUrl(url), label: `${DOC_LABEL[field]} - ${item.truck_number}` })}
              className="inline-flex items-center gap-1 text-sm hover:underline"
              style={{ color: 'var(--monday-cornflower)' }}
            >
              <FileText className="h-3.5 w-3.5" /> View
            </button>
          )}
          <input type="file" accept=".pdf,image/*,.heic,.heif" className="hidden" id={inputId} onChange={(e) => uploadDoc(e, item.id, field)} />
          <label htmlFor={inputId} className={url ? 'text-xs text-gray-500 hover:text-gray-700 cursor-pointer' : 'text-sm cursor-pointer hover:underline'} style={url ? undefined : { color: 'var(--monday-cornflower)' }}>
            {url ? 'Replace' : 'Upload'}
          </label>
        </div>
      </td>
    )
  }

  const renderEquipmentRow = (item: any, index: number) => {
    const inactive = INACTIVE.has(item.status)
    return (
      <tr
        key={item.id}
        className="border-b transition-colors cursor-pointer"
        style={{
          borderColor: 'var(--monday-border-light)',
          backgroundColor: 'var(--monday-bg-primary)',
          opacity: inactive ? 0.55 : 1
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--monday-bg-primary)'
        }}
        onClick={() => handleEditTruck(item)}
        onContextMenu={(e) => handleRowRightClick(item, e)}
      >
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="font-medium" style={{ fontSize: '13px', color: 'var(--monday-cornflower)', textDecoration: inactive ? 'line-through' : undefined }}>{item.truck_number}</span>
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.year || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.make || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.model || 'N/A'}
        </td>
        <td className="px-3 py-2.5 border-r" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--monday-text-secondary)' }}>{item.vin || 'N/A'}</span>
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          ${item.value ? Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          <span title={item.odometer_at ? `Peak ELD odometer, ${new Date(item.odometer_at).toLocaleString()}` : 'Typed in (not matched to a Peak ELD truck)'}>
            {item.miles ? Number(item.miles).toLocaleString() : '0'}
            {item.odometer_at && <span className="ml-1 rounded px-1" style={{ fontSize: '10px', backgroundColor: 'rgba(0, 200, 117, 0.15)', color: 'var(--monday-done)' }}>ELD</span>}
          </span>
        </td>
        <td className="px-3 py-2.5 border-r text-right" style={{ borderColor: 'var(--monday-border-light)', fontSize: '13px', color: 'var(--monday-text-primary)' }}>
          {item.mpg ? Number(item.mpg).toFixed(1) : '0.0'}
        </td>
        {docCell(item, 'registration_url')}
        {docCell(item, 'inspection_url')}
        <td className="px-3 py-2.5" style={{ borderColor: 'var(--monday-border-light)' }}>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{
            backgroundColor: item.status === 'available' ? 'rgba(0, 200, 117, 0.15)' :
              item.status === 'in_use' || item.status === 'in_transit' ? 'rgba(27, 42, 65, 0.15)' :
              item.status === 'maintenance' ? 'rgba(253, 171, 61, 0.15)' :
              inactive ? 'rgba(128, 128, 128, 0.18)' :
              'rgba(226, 68, 92, 0.15)',
            color: item.status === 'available' ? 'var(--monday-done)' :
              item.status === 'in_use' || item.status === 'in_transit' ? 'var(--monday-cornflower)' :
              item.status === 'maintenance' ? 'var(--monday-working)' :
              inactive ? 'var(--monday-text-secondary)' :
              'var(--monday-stuck)'
          }}>
            {STATUS_LABEL[item.status as keyof typeof STATUS_LABEL] || item.status}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <Layout>
      <div className="page-trucks space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>Equipment</h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>Manage your fleet equipment and vehicles</p>
          </div>
          <Button className="hover:opacity-90" style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }} onClick={handleCreateTruck}>
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </div>

        {/* Company / Owner Operators */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {([['company', 'Company'], ['owner_operator', 'Owner Operators']] as [TruckOwnership, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-2 text-sm transition-all"
              style={{
                color: tab === key ? 'var(--monday-done)' : 'var(--monday-text-secondary)',
                borderBottom: tab === key ? '3px solid var(--monday-done)' : '3px solid transparent',
                marginBottom: '-1px',
                fontWeight: tab === key ? 600 : 500,
                fontSize: '14px'
              }}
            >
              {label}
              <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.7 }}>({counts[key]})</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid var(--monday-border-light)', backgroundColor: 'var(--monday-bg-primary)' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Unit #</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Year</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Make</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Model</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>VIN</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Value</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Miles</th>
                <th className="px-3 py-2.5 text-right border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>MPG</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Registration</th>
                <th className="px-3 py-2.5 text-left border-b border-r" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Inspection</th>
                <th className="px-3 py-2.5 text-left border-b" style={{ borderColor: 'var(--monday-border-light)', fontSize: '12px', fontWeight: 500, color: 'var(--monday-text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Trucks Section Header */}
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <td colSpan={11} className="px-3 py-2 font-semibold" style={{ fontSize: '14px', color: 'var(--monday-text-primary)', borderBottom: '1px solid var(--monday-border-light)' }}>
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4" style={{ color: 'var(--monday-cornflower)' }} />
                    Trucks ({trucksOnly.length})
                  </div>
                </td>
              </tr>

              {/* Truck Rows */}
              {trucksOnly.map((truck, index) => renderEquipmentRow(truck, index))}

              {trucksOnly.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                    No trucks added yet
                  </td>
                </tr>
              )}

              {/* Trailers Section Header */}
              <tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <td colSpan={11} className="px-3 py-2 font-semibold" style={{ fontSize: '14px', color: 'var(--monday-text-primary)', borderBottom: '1px solid var(--monday-border-light)' }}>
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4" style={{ color: 'var(--monday-purple)' }} />
                    Trailers ({trailersOnly.length})
                  </div>
                </td>
              </tr>

              {/* Trailer Rows */}
              {trailersOnly.map((trailer, index) => renderEquipmentRow(trailer, index))}

              {trailersOnly.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center" style={{ fontSize: '13px', color: 'var(--monday-text-muted)' }}>
                    No trailers added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>


        {docModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setDocModal(null)}>
            <div className="flex h-5/6 w-11/12 flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold">{docModal.label}</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete this ${DOC_LABEL[docModal.field].toLowerCase()}?`)) {
                        updateTruck.mutate({ id: docModal.truckId, data: { [docModal.field]: null } as any })
                        setDocModal(null)
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                  <button onClick={() => setDocModal(null)} className="rounded-full p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-4">
                <PdfViewer url={docModal.url} title={docModal.label} />
              </div>
            </div>
          </div>
        )}

        <TruckModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTruck}
          truck={editingTruck}
          mode={modalMode}
          defaultOwnership={tab}
        />

        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isVisible={contextMenu.isVisible}
          onClose={closeContextMenu}
        >
          <ContextMenuItem
            onClick={handleContextEdit}
            icon={<Edit className="h-4 w-4" />}
          >
            Edit Truck
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Truck
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}