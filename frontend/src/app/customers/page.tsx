'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatDate } from '@/lib/utils'
import { CustomerModal, CustomerData } from '@/components/customers/customer-modal'
import { Plus, Building2, Phone, Mail, MapPin, Edit, Trash2, User, ArrowRightLeft } from 'lucide-react'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/use-customers'

type CustomerTab = 'broker' | 'customer'
const TAB_LABEL: Record<CustomerTab, { tab: string; noun: string }> = {
  broker: { tab: 'Brokers', noun: 'Broker' },
  customer: { tab: 'Customers', noun: 'Customer' },
}
// Anything entered before Brokers and Customers were split is a broker.
const typeOf = (c: { customer_type?: string }): CustomerTab => (c.customer_type === 'customer' ? 'customer' : 'broker')

export default function CustomersPage() {
  // Fetch customers from API
  const { data: customersData, isLoading } = useCustomers()
  const rawCustomers = customersData?.items || []
  const [tab, setTab] = useState<CustomerTab>('broker')
  const { noun } = TAB_LABEL[tab]
  const counts = useMemo(() => ({
    broker: rawCustomers.filter(c => typeOf(c) === 'broker').length,
    customer: rawCustomers.filter(c => typeOf(c) === 'customer').length,
  }), [rawCustomers])

  // This tab's rows, alphabetically by name
  const customers = useMemo(() => {
    return rawCustomers.filter(c => typeOf(c) === tab).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    )
  }, [rawCustomers, tab])
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: CustomerData | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

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
  const handleRowRightClick = (row: CustomerData, event: React.MouseEvent) => {
    setContextMenu({ isVisible: true, x: event.clientX, y: event.clientY, row })
  }
  const closeContextMenu = () => setContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  const handleContextEdit = () => {
    if (contextMenu.row) {
      setEditingCustomer(contextMenu.row)
      setModalMode('edit')
      setIsModalOpen(true)
    }
    closeContextMenu()
  }
  const handleContextMove = () => {
    if (contextMenu.row?.id) {
      updateCustomer.mutate({ id: contextMenu.row.id, data: { customer_type: tab === 'broker' ? 'customer' : 'broker' } as any })
    }
    closeContextMenu()
  }
  const handleContextDelete = () => {
    if (contextMenu.row && confirm(`Delete ${noun.toLowerCase()}?`)) {
      deleteCustomer.mutate(contextMenu.row.id!)
    }
    closeContextMenu()
  }
  const handleSaveCustomer = (customerData: CustomerData) => {
    const backendData = {
      name: customerData.name,
      mc: customerData.mc,
      contact_person: customerData.contact_person,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address,
      city: customerData.city,
      state: customerData.state,
      zip_code: customerData.zip_code,
      status: customerData.status,
      // New ones go on the tab they were added from
      ...(modalMode === 'create' ? { customer_type: tab } : {}),
    }

    if (modalMode === 'create') {
      createCustomer.mutate(backendData as any)
    } else if (editingCustomer?.id) {
      updateCustomer.mutate({ id: editingCustomer.id, data: backendData as any })
    }
    setIsModalOpen(false)
  }
  const calculateGroupTotals = (rows: CustomerData[]) => ({
    'name': <span className="text-sm font-medium text-gray-900">{rows.length} {noun.toLowerCase()}{rows.length !== 1 ? 's' : ''}</span>
  })
  const totals = useMemo(() => ({
    total: customers.length
  }), [customers])

  const columns: Column<typeof customers[0]>[] = [
    {
      key: 'name',
      label: 'Company Name',
      width: '160px',
      filterable: true,
      groupable: true,
      render: (value) => <span className="font-medium" style={{ color: 'var(--monday-text-primary)' }}>{value}</span>
    },
    {
      key: 'mc',
      label: 'MC Number',
      width: '120px',
      filterable: true,
      render: (value) => <span style={{ color: value ? 'var(--monday-text-primary)' : 'var(--monday-text-muted)' }}>{value || 'N/A'}</span>
    },
    {
      key: 'contact_person',
      label: 'Contact Person',
      width: '140px',
      filterable: true,
      render: (value) => <span style={{ color: value ? 'var(--monday-text-primary)' : 'var(--monday-text-muted)' }}>{value || 'N/A'}</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '140px',
      render: (value) => (
        <div className="flex items-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
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
        <div className="flex items-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
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
        <div className="flex items-center text-sm" style={{ color: 'var(--monday-text-secondary)' }}>
          <MapPin className="mr-1 h-3 w-3" />
          {[value, row.state].filter(Boolean).join(', ')}
        </div>
      )
    },
  ]

  return (
    <Layout>
      <div className="page-customers space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center" style={{ color: 'var(--monday-text-primary)' }}>
              <Building2 className="mr-3 h-8 w-8" style={{ color: 'var(--monday-stuck)' }} />
              Customers
            </h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>Manage your brokers and customers</p>
          </div>
          <Button className="hover:opacity-90" style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }} onClick={handleCreateCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            Add {noun}
          </Button>
        </div>

        {/* Brokers / Customers */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--monday-border-light)' }}>
          {(['broker', 'customer'] as CustomerTab[]).map(key => (
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
              {TAB_LABEL[key].tab}
              <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.7 }}>({counts[key]})</span>
            </button>
          ))}
        </div>

        <DataTable data={customers} columns={columns} onRowRightClick={handleRowRightClick} calculateGroupTotals={calculateGroupTotals} />

        <div className="sticky bottom-0 shadow-lg mt-4" style={{ backgroundColor: 'var(--monday-bg-primary)', borderTop: '2px solid var(--monday-border)' }}>
          <div style={{ minWidth: '1080px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody><tr style={{ backgroundColor: 'var(--monday-bg-secondary)' }}>
                <td className="px-3 py-2 text-sm border-r" style={{ width: '160px', borderColor: 'var(--monday-border-light)' }}>
                  <span className="font-medium" style={{ color: 'var(--monday-text-primary)' }}>{totals.total} {noun}{totals.total !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-3 py-2 text-sm border-r" style={{ width: '120px', borderColor: 'var(--monday-border-light)' }}></td>
                <td className="px-3 py-2 text-sm border-r" style={{ width: '140px', borderColor: 'var(--monday-border-light)' }}></td>
                <td className="px-3 py-2 text-sm border-r" style={{ width: '140px', borderColor: 'var(--monday-border-light)' }}></td>
                <td className="px-3 py-2 text-sm border-r" style={{ width: '180px', borderColor: 'var(--monday-border-light)' }}></td>
                <td className="px-3 py-2 text-sm" style={{ width: '140px' }}></td>
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
          noun={noun}
        />

        <ContextMenu x={contextMenu.x} y={contextMenu.y} isVisible={contextMenu.isVisible} onClose={closeContextMenu}>
          <ContextMenuItem onClick={handleContextEdit} icon={<Edit className="h-4 w-4" />}>Edit {noun}</ContextMenuItem>
          <ContextMenuItem onClick={handleContextMove} icon={<ArrowRightLeft className="h-4 w-4" />}>Move to {tab === 'broker' ? 'Customers' : 'Brokers'}</ContextMenuItem>
          <ContextMenuItem onClick={handleContextDelete} icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50">Delete {noun}</ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}