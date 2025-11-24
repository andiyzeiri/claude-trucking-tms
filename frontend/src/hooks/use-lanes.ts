'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface Lane {
  id: number
  pickup_location: string
  delivery_location: string
  broker: string
  email?: string
  phone?: string
  notes?: string
  route: string
  created_at: string
  updated_at?: string
  company_id: number
}

export interface PaginatedLanes {
  items: Lane[]
  total: number
  page: number
  limit: number
}

export function useLanes(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['lanes', page, limit],
    queryFn: async (): Promise<PaginatedLanes> => {
      const response = await api.get(`/v1/lanes?skip=${(page - 1) * limit}&limit=${limit}`)
      const lanes = Array.isArray(response.data) ? response.data : []
      return {
        items: lanes,
        total: lanes.length,
        page,
        limit
      }
    },
    retry: false,
  })
}

export function useLane(id: number) {
  return useQuery({
    queryKey: ['lane', id],
    queryFn: async (): Promise<Lane> => {
      const response = await api.get(`/v1/lanes/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Lane>): Promise<Lane> => {
      const response = await api.post('/v1/lanes', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lanes'] })
      toast.success('Lane created successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create lane'
      toast.error(message)
    },
  })
}

export function useUpdateLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Lane> }): Promise<Lane> => {
      const response = await api.put(`/v1/lanes/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['lanes'] })
      queryClient.invalidateQueries({ queryKey: ['lane', id] })
      toast.success('Lane updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update lane'
      toast.error(message)
    },
  })
}

export function useDeleteLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/lanes/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lanes'] })
      toast.success('Lane deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete lane'
      toast.error(message)
    },
  })
}
