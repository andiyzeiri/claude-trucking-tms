'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Truck, PaginatedResponse } from '@/types'
import { TruckFormData } from '@/lib/schemas'

export function useTrucks(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['trucks', page, limit],
    queryFn: async (): Promise<PaginatedResponse<Truck>> => {
      try {
        const response = await api.get(`/trucks?page=${page}&limit=${limit}`)
        return response.data
      } catch (error: any) {
        // Always fall back to demo data on any error
        const response = await api.get(`/demo/trucks`)
        return response.data
      }
    },
    retry: false,
  })
}

export function useTruck(id: number) {
  return useQuery({
    queryKey: ['truck', id],
    queryFn: async (): Promise<Truck> => {
      const response = await api.get(`/trucks/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateTruck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TruckFormData): Promise<Truck> => {
      const response = await api.post('/trucks', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] })
      toast.success('Truck created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create truck')
    },
  })
}

export function useUpdateTruck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TruckFormData }): Promise<Truck> => {
      const response = await api.put(`/trucks/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] })
      queryClient.invalidateQueries({ queryKey: ['truck', id] })
      toast.success('Truck updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update truck')
    },
  })
}