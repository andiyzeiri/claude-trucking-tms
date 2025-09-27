'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatDate } from '@/lib/utils'
import { CustomerModal, CustomerData } from '@/components/customers/customer-modal'
import { Plus, Building2, Phone, Mail, MapPin, Edit, Trash2, User } from 'lucide-react'

export default function CustomersPage() {
  // State for managing customers
  const [customers, setCustomers] = useState([
      {
        id: 1,
        name: "ABC Logistics",
        contact_name: "Alice Johnson",
        phone: "(555) 123-0001",
        email: "alice@abclogistics.com",
        city: "Los Angeles",
        state: "CA",
        status: "active",
        created_at: "2024-01-01T00:00:00Z"
      },
      {
        id: 2,
        name: "XYZ Shipping",
        contact_name: "Bob Martinez",
        phone: "(555) 123-0002",
        email: "bob@xyzshipping.com",
        city: "Dallas",
        state: "TX",
        status: "active",
        created_at: "2024-01-02T00:00:00Z"
      },
      {
        id: 3,
        name: "Global Transport",
        contact_name: "Carol Davis",
        phone: "(555) 123-0003",
        email: "carol@globaltransport.com",
        city: "Chicago",
        state: "IL",
        status: "inactive",
        created_at: "2024-01-03T00:00:00Z"
      }
  ])

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof customers[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Handlers and totals
  const handleCreateCustomer = () => {
    setEditingCustomer(null)
    setModalMode('create')
    setIsModalOpen(true)
  }
  const handleRowRightClick = (row: typeof customers[0], event: React.MouseEvent) => {
    setContextMenu({ isVisible: true, x: event.clientX, y: event.clientY, row })
  }
  const closeContextMenu = () => setContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  const handleContextEdit = () => {
    if (contextMenu.row) {
      setEditingCustomer(contextMenu.row as CustomerData)
      setModalMode('edit')
      setIsModalOpen(true)
    }
    closeContextMenu()
  }
  const handleContextDelete = () => {
    if (contextMenu.row && confirm('Delete customer?')) {
      setCustomers(customers.filter(c => c.id !== contextMenu.row!.id))
    }
    closeContextMenu()
  }
  const handleSaveCustomer = (customerData: CustomerData) => {
    if (modalMode === 'create') {
      const newCustomer = {
        ...customerData,
        id: Math.max(...customers.map(c => c.id || 0)) + 1
      }
      setCustomers([...customers, newCustomer])
    } else {
      setCustomers(customers.map(customer =>
        customer.id === editingCustomer?.id ? { ...customerData, id: editingCustomer.id } : customer
      ))
    }
  }
  const calculateGroupTotals = (rows: typeof customers[0][]) => ({
    'name': <span className="text-sm font-medium text-gray-900">{rows.length} customer{rows.length !== 1 ? 's' : ''}</span>
  })
  const totals = useMemo(() => ({
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length
  }), [customers])

  const columns: Column<typeof customers[0]>[] = [
    {
      key: 'name',
      label: 'Company Name',
      width: '160px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'contact_name',
      label: 'Contact Person',
      width: '140px',
      filterable: true,
      render: (value) => value || 'N/A'
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '140px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="mr-1 h-3 w-3" />
          {value}
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      width: '180px',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="mr-1 h-3 w-3" />
          {value}
        </div>
      )
    },
    {
      key: 'city',
      label: 'Location',
      width: '140px',
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="mr-1 h-3 w-3" />
          {[value, row.state].filter(Boolean).join(', ')}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      filterable: true,
      groupable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '120px',
      render: (value) => formatDate(value)
    }
  ]

  return (
    <Layout>
      <div className="page-customers space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Building2 className="mr-3 h-8 w-8" />
              Customers
            </h1>
            <p className="text-gray-600">Manage your customer relationships</p>
          </div>
          <Button onClick={handleCreateCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <DataTable data={customers} columns={columns} onRowRightClick={handleRowRightClick} calculateGroupTotals={calculateGroupTotals} />

        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody><tr className="bg-gray-50">
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '160px' }}>
                  <span className="font-medium text-gray-900">{totals.total} Customer{totals.total !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '180px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '140px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '100px' }}>
                  <span className="text-green-700">{totals.active} Active</span>
                </td>
                <td className="px-3 py-2 text-sm" style={{ width: '120px' }}>
                  <span className="text-gray-700">{totals.inactive} Inactive</span>
                </td>
              </tr></tbody>
            </table>
          </div>
        </div>

        <CustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveCustomer}
          customer={editingCustomer}
          mode={modalMode}
        />

        <ContextMenu x={contextMenu.x} y={contextMenu.y} isVisible={contextMenu.isVisible} onClose={closeContextMenu}>
          <ContextMenuItem onClick={handleContextEdit} icon={<Edit className="h-4 w-4" />}>Edit Customer</ContextMenuItem>
          <ContextMenuItem onClick={handleContextDelete} icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50">Delete Customer</ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}