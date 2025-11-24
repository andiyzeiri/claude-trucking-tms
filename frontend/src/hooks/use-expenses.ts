'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Expense, PaginatedResponse } from '@/types'

export interface ExpenseFormData {
  date: string
  category: string
  description?: string
  amount: number
  vendor?: string
  payment_method?: string
  receipt_number?: string
  driver_id?: number
  truck_id?: number
  load_id?: number
}

export function useExpenses(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['expenses', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Expense>> => {
      const response = await api.get(`/v1/expenses?skip=${(page - 1) * limit}&limit=${limit}`)
      const expenses = Array.isArray(response.data) ? response.data : []
      return {
        items: expenses,
        total: expenses.length,
        page,
        per_page: limit,
        pages: 1
      }
    },
    retry: false,
  })
}

export function useExpense(id: number) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: async (): Promise<Expense> => {
      const response = await api.get(`/v1/expenses/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ExpenseFormData): Promise<Expense> => {
      const response = await api.post('/v1/expenses', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to create expense'
      toast.error(message)
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ExpenseFormData> }): Promise<Expense> => {
      const response = await api.put(`/v1/expenses/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense', id] })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to update expense'
      toast.error(message)
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/expenses/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Failed to delete expense'
      toast.error(message)
    },
  })
}
