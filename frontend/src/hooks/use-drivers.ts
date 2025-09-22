'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Driver, PaginatedResponse } from '@/types'
import { DriverFormData } from '@/lib/schemas'

export function useDrivers(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['drivers', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Driver>> => {
      try {
        const response = await api.get(`/drivers?page=${page}&limit=${limit}`)
        return response.data
      } catch (error: any) {
        // Always fall back to demo data on any error
        const response = await api.get(`/demo/drivers`)
        return response.data
      }
    },
    retry: false,
  })
}

export function useDriver(id: number) {
  return useQuery({
    queryKey: ['driver', id],
    queryFn: async (): Promise<Driver> => {
      const response = await api.get(`/drivers/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DriverFormData): Promise<Driver> => {
      const response = await api.post('/drivers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      toast.success('Driver created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create driver')
    },
  })
}

export function useUpdateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DriverFormData }): Promise<Driver> => {
      const response = await api.put(`/drivers/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
      toast.success('Driver updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update driver')
    },
  })
}