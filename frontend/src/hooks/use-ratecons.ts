'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Ratecon, PaginatedResponse } from '@/types'

export function useRatecons(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['ratecons', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Ratecon>> => {
      const response = await api.get(`/v1/ratecons?skip=${(page - 1) * limit}&limit=${limit}`)
      const ratecons = Array.isArray(response.data) ? response.data : []
      return {
        items: ratecons,
        total: ratecons.length,
        page,
        per_page: limit,
        pages: Math.ceil(ratecons.length / limit)
      }
    },
    retry: false,
  })
}

export function useRatecon(id: number) {
  return useQuery({
    queryKey: ['ratecon', id],
    queryFn: async (): Promise<Ratecon> => {
      const response = await api.get(`/v1/ratecons/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateRatecon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Ratecon>): Promise<Ratecon> => {
      const response = await api.post('/v1/ratecons', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratecons'] })
      toast.success('Ratecon created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create ratecon')
    },
  })
}

export function useUpdateRatecon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Ratecon> }): Promise<Ratecon> => {
      const response = await api.put(`/v1/ratecons/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ratecons'] })
      queryClient.invalidateQueries({ queryKey: ['ratecon', id] })
      toast.success('Ratecon updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update ratecon')
    },
  })
}

export function useDeleteRatecon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/ratecons/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratecons'] })
      toast.success('Ratecon deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete ratecon')
    },
  })
}
