'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Driver, PaginatedResponse } from '@/types'
import { DriverFormData } from '@/lib/schemas'

export function useDrivers(page = 1, limit = 100) {
  return useQuery({
    queryKey: ['drivers', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Driver>> => {
      const response = await api.get(`/v1/drivers?skip=${(page - 1) * limit}&limit=${limit}`)
      console.log('useDrivers - fetched drivers:', JSON.stringify(response.data, null, 2))
      // Backend returns array, convert to paginated format
      const drivers = Array.isArray(response.data) ? response.data : []
      return {
        items: drivers,
        total: drivers.length,
        page,
        limit
      }
    },
    retry: false,
  })
}

export function useDriver(id: number) {
  return useQuery({
    queryKey: ['driver', id],
    queryFn: async (): Promise<Driver> => {
      const response = await api.get(`/v1/drivers/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DriverFormData): Promise<Driver> => {
      const response = await api.post('/v1/drivers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      toast.success('Driver created successfully')
    },
    onError: (error: any) => {
      console.error('useCreateDriver error:', error.response?.data)
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to create driver'
      toast.error(message)
    },
  })
}

export function useUpdateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DriverFormData }): Promise<Driver> => {
      const response = await api.put(`/v1/drivers/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
      toast.success('Driver updated successfully')
    },
    onError: (error: any) => {
      console.error('useUpdateDriver error:', error.response?.data)
      const detail = error.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'Failed to update driver'
      toast.error(message)
    },
  })
}