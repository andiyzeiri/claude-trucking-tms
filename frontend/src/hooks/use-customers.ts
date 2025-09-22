'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Customer, PaginatedResponse } from '@/types'
import { CustomerFormData } from '@/lib/schemas'

export function useCustomers(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['customers', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Customer>> => {
      try {
        const response = await api.get(`/customers?page=${page}&limit=${limit}`)
        return response.data
      } catch (error: any) {
        // Always fall back to demo data on any error
        const response = await api.get(`/demo/customers`)
        return response.data
      }
    },
    retry: false,
  })
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async (): Promise<Customer> => {
      const response = await api.get(`/customers/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CustomerFormData): Promise<Customer> => {
      const response = await api.post('/customers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create customer')
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CustomerFormData }): Promise<Customer> => {
      const response = await api.put(`/customers/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      toast.success('Customer updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update customer')
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/customers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete customer')
    },
  })
}