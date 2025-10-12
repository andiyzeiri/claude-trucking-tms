'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Receiver, PaginatedResponse } from '@/types'

export function useReceivers(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['receivers', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Receiver>> => {
      const response = await api.get(`/v1/receivers?skip=${(page - 1) * limit}&limit=${limit}`)
      const receivers = Array.isArray(response.data) ? response.data : []
      return {
        items: receivers,
        total: receivers.length,
        page,
        per_page: limit,
        pages: Math.ceil(receivers.length / limit)
      }
    },
    retry: false,
  })
}

export function useReceiver(id: number) {
  return useQuery({
    queryKey: ['receiver', id],
    queryFn: async (): Promise<Receiver> => {
      const response = await api.get(`/v1/receivers/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateReceiver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Receiver>): Promise<Receiver> => {
      const response = await api.post('/v1/receivers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] })
      toast.success('Receiver created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create receiver')
    },
  })
}

export function useUpdateReceiver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Receiver> }): Promise<Receiver> => {
      const response = await api.put(`/v1/receivers/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] })
      queryClient.invalidateQueries({ queryKey: ['receiver', id] })
      toast.success('Receiver updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update receiver')
    },
  })
}

export function useDeleteReceiver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/receivers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] })
      toast.success('Receiver deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete receiver')
    },
  })
}
