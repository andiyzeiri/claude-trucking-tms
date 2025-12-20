'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { useDedicatedLanes, useDeleteDedicatedLane, DedicatedLane, getDayName } from '@/hooks/use-dedicated-lanes'
import { formatCurrency } from '@/lib/utils'
import { DedicatedLaneModal } from './dedicated-lane-modal'

interface DedicatedLanesPanelProps {
  onClose: () => void
}

export function DedicatedLanesPanel({ onClose }: DedicatedLanesPanelProps) {
  const { data: dedicatedLanesData, isLoading } = useDedicatedLanes(1, 100, false) // Get all, including inactive
  const dedicatedLanes = dedicatedLanesData?.items || []
  const deleteDedicatedLane = useDeleteDedicatedLane()

  const [editingLane, setEditingLane] = useState<DedicatedLane | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAddNew = () => {
    setEditingLane(null)
    setIsModalOpen(true)
  }

  const handleEdit = (lane: DedicatedLane) => {
    setEditingLane(lane)
    setIsModalOpen(true)
  }

  const handleDelete = async (lane: DedicatedLane) => {
    if (confirm(`Are you sure you want to delete the dedicated lane "${lane.name}"?`)) {
      await deleteDedicatedLane.mutateAsync(lane.id)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingLane(null)
  }

  return (
    <div className="mb-4 border rounded-lg bg-white overflow-hidden shadow-sm" style={{ borderColor: '#0086c0' }}>
      <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: 'rgba(0, 134, 192, 0.05)', borderColor: 'var(--monday-border-light)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: '#0086c0' }}>Dedicated Lanes</h2>
          <span className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
            Recurring lanes that auto-create loads every Monday for the following week
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddNew} size="sm" className="flex items-center gap-1" style={{ backgroundColor: '#0086c0' }}>
            <Plus className="h-4 w-4" />
            Add Lane
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--monday-text-secondary)' }}>Loading dedicated lanes...</div>
        ) : dedicatedLanes.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--monday-text-secondary)' }}>
            <p>No dedicated lanes yet.</p>
            <p className="text-sm mt-1">Add a dedicated lane to automatically create recurring loads every week.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Route</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Day</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Customer</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Driver</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Rate</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Miles</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dedicatedLanes.map((lane) => (
                <tr key={lane.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--monday-border-light)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--monday-text-primary)' }}>{lane.name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>{lane.route}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>{lane.day_name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>{lane.customer?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>
                    {lane.driver ? `${lane.driver.first_name} ${lane.driver.last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>
                    {lane.rate ? formatCurrency(lane.rate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--monday-text-primary)' }}>{lane.miles || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: lane.is_active ? 'rgba(0, 200, 117, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                        color: lane.is_active ? 'var(--monday-done)' : 'var(--monday-text-secondary)'
                      }}
                    >
                      {lane.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(lane)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" style={{ color: 'var(--monday-text-secondary)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(lane)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: 'var(--monday-text-secondary)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <DedicatedLaneModal
          lane={editingLane}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
