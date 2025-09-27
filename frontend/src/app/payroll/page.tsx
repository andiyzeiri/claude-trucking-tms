'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { PayrollModal, PayrollData } from '@/components/payroll/payroll-modal'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit, Trash2, Calculator } from 'lucide-react'

export default function PayrollPage() {
  // Driver status lookup (in real app this would come from drivers API)
  const driverStatus = {
    "John Smith": { terminated: false },
    "Jane Doe": { terminated: false },
    "Mike Johnson": { terminated: true }, // This driver is terminated
    "Robert Wilson": { terminated: false },
    "Sarah Davis": { terminated: false }
  }

  // State for managing payroll entries
  const [allPayrollEntries, setAllPayrollEntries] = useState<PayrollData[]>([
    {
      id: 1,
      week: "Week 1 (Dec 30 - Jan 5)",
      driver: "John Smith",
      type: "company",
      gross: 2500.00,
      dispatch_fee: 250.00,
      insurance: 150.00,
      fuel: 600.00,
      parking: 75.00,
      trailer: 50.00,
      misc: 25.00,
      miles: 1250,
      check: 1350.00,
      rpm: 2.00,
      escrow: 0.00
    },
    {
      id: 2,
      week: "Week 2 (Jan 6 - Jan 12)",
      driver: "Jane Doe",
      type: "company",
      gross: 3200.00,
      dispatch_fee: 320.00,
      insurance: 150.00,
      fuel: 800.00,
      parking: 100.00,
      trailer: 50.00,
      misc: 50.00,
      miles: 1600,
      check: 1730.00,
      rpm: 2.00,
      escrow: 0.00
    },
    {
      id: 3,
      week: "Week 3 (Jan 13 - Jan 19)",
      driver: "Robert Wilson",
      type: "owner_operator",
      gross: 4500.00,
      dispatch_fee: 450.00,
      insurance: 0.00,
      fuel: 0.00,
      parking: 0.00,
      trailer: 0.00,
      misc: 0.00,
      miles: 2000,
      check: 4050.00,
      rpm: 2.25,
      escrow: 200.00
    },
    {
      id: 4,
      week: "Week 4 (Jan 20 - Jan 26)",
      driver: "Mike Johnson", // This is a terminated driver
      type: "company",
      gross: 1800.00,
      dispatch_fee: 180.00,
      insurance: 150.00,
      fuel: 450.00,
      parking: 50.00,
      trailer: 50.00,
      misc: 20.00,
      miles: 900,
      check: 900.00,
      rpm: 2.00,
      escrow: 0.00
    },
    {
      id: 5,
      week: "Week 1 (Dec 30 - Jan 5)",
      driver: "Sarah Davis",
      type: "owner_operator",
      gross: 3800.00,
      dispatch_fee: 380.00,
      insurance: 0.00,
      fuel: 0.00,
      parking: 0.00,
      trailer: 0.00,
      misc: 0.00,
      miles: 1900,
      check: 3420.00,
      rpm: 2.00,
      escrow: 150.00
    }
  ])

  // Filter out terminated drivers
  const payrollEntries = useMemo(() => {
    return allPayrollEntries.filter(entry => {
      const driver = driverStatus[entry.driver as keyof typeof driverStatus]
      return !driver?.terminated
    })
  }, [allPayrollEntries])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayroll, setEditingPayroll] = useState<PayrollData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: PayrollData | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  // CRUD operations
  const handleCreatePayroll = () => {
    setModalMode('create')
    setEditingPayroll(null)
    setIsModalOpen(true)
  }

  const handleEditPayroll = (entry: PayrollData) => {
    setModalMode('edit')
    setEditingPayroll(entry)
    setIsModalOpen(true)
  }

  const handleDeletePayroll = (entryId: number) => {
    if (confirm('Are you sure you want to delete this payroll entry?')) {
      setAllPayrollEntries(allPayrollEntries.filter(entry => entry.id !== entryId))
    }
  }

  const handleSavePayroll = (payrollData: PayrollData) => {
    if (modalMode === 'create') {
      const newId = Math.max(...allPayrollEntries.map(p => p.id || 0), 0) + 1
      setAllPayrollEntries([...allPayrollEntries, { ...payrollData, id: newId }])
    } else {
      setAllPayrollEntries(allPayrollEntries.map(entry =>
        entry.id === editingPayroll?.id ? { ...payrollData, id: entry.id } : entry
      ))
    }
    setIsModalOpen(false)
  }

  // Context menu handlers
  const handleRightClick = (row: PayrollData, event: React.MouseEvent) => {
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
      handleEditPayroll(contextMenu.row)
    }
    closeContextMenu()
  }

  const handleContextDelete = () => {
    if (contextMenu.row) {
      handleDeletePayroll(contextMenu.row.id!)
    }
    closeContextMenu()
  }


  // Define column structure similar to loads page
  const columns: Column<PayrollData>[] = [
    {
      key: 'week',
      label: 'Week',
      width: '180px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'driver',
      label: 'Driver',
      width: '150px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium text-blue-600">{value}</span>
    },
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'company' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {value === 'company' ? 'Company' : 'Owner Op'}
        </span>
      )
    },
    {
      key: 'gross',
      label: 'Gross',
      width: '100px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'miles',
      label: 'Miles',
      width: '80px',
      render: (value) => value.toLocaleString()
    },
    {
      key: 'rpm',
      label: 'RPM',
      width: '80px',
      render: (value) => `$${value.toFixed(2)}`
    },
    {
      key: 'check',
      label: 'Check Amount',
      width: '120px',
      render: (value) => (
        <span className="font-medium text-green-600">
          {formatCurrency(value)}
        </span>
      )
    },
    {
      key: 'dispatch_fee',
      label: 'Dispatch Fee',
      width: '110px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'insurance',
      label: 'Insurance',
      width: '110px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'fuel',
      label: 'Fuel',
      width: '110px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'parking',
      label: 'Parking',
      width: '110px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'trailer',
      label: 'Trailer',
      width: '110px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'misc',
      label: 'Misc',
      width: '110px',
      render: (value) => formatCurrency(value)
    }
  ]

  return (
    <Layout>
      <div className="page-payroll space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="text-gray-600">Manage driver payroll and payments</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreatePayroll}>
            <Plus className="mr-2 h-4 w-4" />
            New Payroll Entry
          </Button>
        </div>

        <DataTable
          data={payrollEntries}
          columns={columns}
          onRowRightClick={handleRightClick}
        />

        {/* Payroll Modal */}
        <PayrollModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSavePayroll}
          payroll={editingPayroll}
          mode={modalMode}
        />

        {/* Context Menu */}
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
            Edit Payroll
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleContextDelete}
            icon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:bg-red-50"
          >
            Delete Payroll
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}