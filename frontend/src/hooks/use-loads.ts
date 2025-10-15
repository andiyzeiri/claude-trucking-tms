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
      const response = await api.get(`/v1/loads?skip=${(page - 1) * limit}&limit=${limit}`)
      // Backend returns array, convert to paginated format
      const loads = Array.isArray(response.data) ? response.data : []
      return {
        items: loads,
        total: loads.length,
        page,
        per_page: limit,
        pages: 1
      }
    },
    retry: false,
  })
}

export function useLoad(id: number) {
  return useQuery({
    queryKey: ['load', id],
    queryFn: async (): Promise<Load> => {
      const response = await api.get(`/v1/loads/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateLoad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: LoadFormData): Promise<Load> => {
      const response = await api.post('/v1/loads', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      toast.success('Load created successfully')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to create load'
      toast.error(message)
    },
  })
}

export function useUpdateLoad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoadFormData> }): Promise<Load> => {
      const response = await api.put(`/v1/loads/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      queryClient.invalidateQueries({ queryKey: ['load', id] })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to update load'
      toast.error(message)
    },
  })
}

export function useDeleteLoad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/loads/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      toast.success('Load deleted successfully')
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Failed to delete load'
      toast.error(message)
    },
  })
}

export function useUpdateLoadDocuments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      pod_url,
      ratecon_url
    }: {
      id: number
      pod_url?: string
      ratecon_url?: string
    }): Promise<Load> => {
      const response = await api.put(`/v1/loads/${id}`, {
        pod_url,
        ratecon_url
      })
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      queryClient.invalidateQueries({ queryKey: ['load', id] })
      toast.success('Documents updated successfully')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : 'Failed to update documents'
      toast.error(message)
    },
  })
}