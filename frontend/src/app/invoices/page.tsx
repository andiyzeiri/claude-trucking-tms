'use client'

import React, { useState, useMemo } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/ui/data-table'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { formatCurrency } from '@/lib/utils'
import { InvoiceModal, InvoiceData } from '@/components/invoices/invoice-modal'
import { Plus, FileText, DollarSign, Clock, CheckCircle, Edit, Trash2, User } from 'lucide-react'
import { useInvoices, useDeleteInvoice, useCreateInvoice, useUpdateInvoice } from '@/hooks/use-invoices'

export default function InvoicesPage() {
  // Fetch real invoice data from API
  const { data, isLoading, error } = useInvoices(1, 100)
  const invoices = data?.items || []
  const deleteInvoice = useDeleteInvoice()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean
    x: number
    y: number
    row: typeof invoices[0] | null
  }>({ isVisible: false, x: 0, y: 0, row: null })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return CheckCircle
      case 'pending': return Clock
      case 'overdue': return Clock
      default: return FileText
    }
  }

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')

  // Handlers and totals
  const handleCreateInvoice = () => {
    setEditingInvoice(null)
    setModalMode('create')
    setIsModalOpen(true)
  }
  const handleRowRightClick = (row: typeof invoices[0], event: React.MouseEvent) => {
    setContextMenu({ isVisible: true, x: event.clientX, y: event.clientY, row })
  }
  const closeContextMenu = () => setContextMenu({ isVisible: false, x: 0, y: 0, row: null })
  const handleContextEdit = () => {
    if (contextMenu.row) {
      const invoiceData: InvoiceData = {
        ...contextMenu.row,
        status: contextMenu.row.status as 'paid' | 'pending' | 'overdue'
      }
      setEditingInvoice(invoiceData)
      setModalMode('edit')
      setIsModalOpen(true)
    }
    closeContextMenu()
  }
  const handleContextDelete = () => {
    if (contextMenu.row && confirm('Delete invoice?')) {
      deleteInvoice.mutate(contextMenu.row.id)
    }
    closeContextMenu()
  }
  const handleSaveInvoice = (invoiceData: InvoiceData) => {
    if (modalMode === 'create') {
      createInvoice.mutate(invoiceData)
    } else if (editingInvoice?.id) {
      updateInvoice.mutate({ id: editingInvoice.id, data: invoiceData })
    }
    setIsModalOpen(false)
  }
  const calculateGroupTotals = (rows: typeof invoices[0][]) => {
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0)
    return {
      'invoice_number': <span className="text-sm font-medium text-gray-900">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</span>,
      'amount': <span className="text-sm font-medium text-green-700">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    }
  }
  const totals = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0)
    const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, invoice) => sum + invoice.amount, 0)
    return { totalRevenue, paidAmount, pendingAmount, total: invoices.length }
  }, [invoices])

  const columns: Column<typeof invoices[0]>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      width: '120px',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      filterable: true,
      groupable: true,
      render: (value) => {
        const StatusIcon = getStatusIcon(value)
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {value}
          </span>
        )
      }
    },
    {
      key: 'customer_id',
      label: 'Customer ID',
      width: '120px',
      filterable: true,
      groupable: true
    },
    {
      key: 'load_id',
      label: 'Load ID',
      width: '120px'
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '120px',
      render: (value) => (
        <div className="font-medium text-gray-900">
          ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )
    },
    {
      key: 'due_date',
      label: 'Due Date',
      width: '120px',
      render: (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '120px',
      render: (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'
    }
  ]

  return (
    <Layout>
      <div className="page-invoices space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
            <p className="text-gray-600">Manage billing and payments</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateInvoice}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-green-600">${totals.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">${totals.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable data={invoices} columns={columns} onRowRightClick={handleRowRightClick} calculateGroupTotals={calculateGroupTotals} />

        <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg mt-4">
          <div style={{ minWidth: '1400px', width: '100%' }}>
            <table className="w-full table-auto">
              <tbody><tr className="bg-gray-50">
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}>
                  <span className="font-medium text-gray-900">{totals.total} Invoice{totals.total !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}></td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}>
                  <span className="text-green-700">${totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
                <td className="px-3 py-2 text-sm border-r border-gray-100" style={{ width: '120px' }}></td>
                <td className="px-3 py-2 text-sm" style={{ width: '120px' }}></td>
              </tr></tbody>
            </table>
          </div>
        </div>

        <InvoiceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveInvoice}
          invoice={editingInvoice}
          mode={modalMode}
        />

        <ContextMenu x={contextMenu.x} y={contextMenu.y} isVisible={contextMenu.isVisible} onClose={closeContextMenu}>
          <ContextMenuItem onClick={handleContextEdit} icon={<Edit className="h-4 w-4" />}>Edit Invoice</ContextMenuItem>
          <ContextMenuItem onClick={handleContextDelete} icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50">Delete Invoice</ContextMenuItem>
        </ContextMenu>
      </div>
    </Layout>
  )
}