'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface Payroll {
  id: number
  week_start: string
  week_end: string
  driver_id: number
  type: 'company' | 'owner_operator'
  gross: number
  extra: number
  dispatch_fee: number
  insurance: number
  fuel: number
  parking: number
  trailer: number
  misc: number
  escrow: number
  miles: number
  check_amount: number
  rpm: number
  week_label: string
  created_at: string
  updated_at?: string
  company_id: number
}

export interface PaginatedPayroll {
  items: Payroll[]
  total: number
  page: number
  limit: number
}

export function usePayroll(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['payroll', page, limit],
    queryFn: async (): Promise<PaginatedPayroll> => {
      const response = await api.get(`/v1/payroll?skip=${(page - 1) * limit}&limit=${limit}`)
      const payroll = Array.isArray(response.data) ? response.data : []
      return {
        items: payroll,
        total: payroll.length,
        page,
        limit
      }
    },
    retry: false,
  })
}

export function usePayrollEntry(id: number) {
  return useQuery({
    queryKey: ['payroll', id],
    queryFn: async (): Promise<Payroll> => {
      const response = await api.get(`/v1/payroll/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreatePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Payroll>): Promise<Payroll> => {
      const response = await api.post('/v1/payroll', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      toast.success('Payroll entry created successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create payroll entry'
      toast.error(message)
    },
  })
}

export function useUpdatePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Payroll> }): Promise<Payroll> => {
      const response = await api.put(`/v1/payroll/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['payroll', id] })
      toast.success('Payroll entry updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update payroll entry'
      toast.error(message)
    },
  })
}

export function useDeletePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/payroll/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      toast.success('Payroll entry deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete payroll entry'
      toast.error(message)
    },
  })
}
