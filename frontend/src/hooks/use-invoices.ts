'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface Invoice {
  id: number
  invoice_number: string
  load_id: number
  customer_id: number
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  created_at: string
  updated_at?: string
}

export interface PaginatedInvoices {
  items: Invoice[]
  total: number
  page: number
  limit: number
}

export function useInvoices(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['invoices', page, limit],
    queryFn: async (): Promise<PaginatedInvoices> => {
      const response = await api.get(`/v1/invoices?skip=${(page - 1) * limit}&limit=${limit}`)
      const invoices = Array.isArray(response.data) ? response.data : []
      return {
        items: invoices,
        total: invoices.length,
        page,
        limit
      }
    },
    retry: false,
  })
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async (): Promise<Invoice> => {
      const response = await api.get(`/v1/invoices/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Invoice>): Promise<Invoice> => {
      const response = await api.post('/v1/invoices', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create invoice'
      toast.error(message)
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Invoice> }): Promise<Invoice> => {
      const response = await api.put(`/v1/invoices/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('Invoice updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update invoice'
      toast.error(message)
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/invoices/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete invoice'
      toast.error(message)
    },
  })
}
