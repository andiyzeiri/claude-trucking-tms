'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Load, PaginatedResponse } from '@/types'
import { LoadFormData } from '@/lib/schemas'

export function useLoads(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['loads', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Load>> => {
      try {
        const response = await api.get(`/loads?page=${page}&limit=${limit}`)
        return response.data
      } catch (error: any) {
        // Always fall back to demo data on any error
        const response = await api.get(`/demo/loads`)
        return response.data
      }
    },
    retry: false,
  })
}

export function useLoad(id: number) {
  return useQuery({
    queryKey: ['load', id],
    queryFn: async (): Promise<Load> => {
      const response = await api.get(`/loads/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateLoad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: LoadFormData): Promise<Load> => {
      const response = await api.post('/loads', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      toast.success('Load created successfully')
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Failed to create load'
      toast.error(message)
    },
  })
}

export function useUpdateLoad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoadFormData> }): Promise<Load> => {
      const response = await api.put(`/loads/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      queryClient.invalidateQueries({ queryKey: ['load', id] })
      toast.success('Load updated successfully')
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Failed to update load'
      toast.error(message)
    },
  })
}