'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Shipper, PaginatedResponse } from '@/types'

export function useShippers(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['shippers', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Shipper>> => {
      const response = await api.get(`/shippers?skip=${(page - 1) * limit}&limit=${limit}`)
      const shippers = Array.isArray(response.data) ? response.data : []
      return {
        items: shippers,
        total: shippers.length,
        page,
        per_page: limit,
        pages: Math.ceil(shippers.length / limit)
      }
    },
    retry: false,
  })
}

export function useSearchShippers(zipCode: string) {
  return useQuery({
    queryKey: ['shippers', 'search', zipCode],
    queryFn: async (): Promise<Shipper[]> => {
      if (!zipCode) return []
      const response = await api.get(`/shippers/search?zip_code=${zipCode}`)
      return Array.isArray(response.data) ? response.data : []
    },
    enabled: zipCode.length >= 3,
    retry: false,
  })
}

export function useShipper(id: number) {
  return useQuery({
    queryKey: ['shipper', id],
    queryFn: async (): Promise<Shipper> => {
      const response = await api.get(`/shippers/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateShipper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Shipper>): Promise<Shipper> => {
      const response = await api.post('/shippers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippers'] })
      toast.success('Shipper created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create shipper')
    },
  })
}

export function useUpdateShipper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Shipper> }): Promise<Shipper> => {
      const response = await api.put(`/shippers/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shippers'] })
      queryClient.invalidateQueries({ queryKey: ['shipper', id] })
      toast.success('Shipper updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update shipper')
    },
  })
}

export function useDeleteShipper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/shippers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippers'] })
      toast.success('Shipper deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete shipper')
    },
  })
}
