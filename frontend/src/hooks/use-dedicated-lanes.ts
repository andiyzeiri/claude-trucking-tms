'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface CustomerInfo {
  id: number
  name: string
}

export interface DriverInfo {
  id: number
  first_name: string
  last_name: string
}

export interface TruckInfo {
  id: number
  unit_number: string
}

export interface DedicatedLane {
  id: number
  name: string
  pickup_location: string
  delivery_location: string
  miles?: number
  day_of_week: number  // 0=Monday, 6=Sunday
  pickup_time?: string
  delivery_time?: string
  rate?: number
  carrier_rate?: number
  fuel_surcharge?: number
  accessorial_charges?: number
  pickup_notes?: string
  delivery_notes?: string
  reference_number?: string
  is_active: boolean
  company_id: number
  customer_id: number
  driver_id?: number
  truck_id?: number
  route: string
  day_name: string
  customer?: CustomerInfo
  driver?: DriverInfo
  truck?: TruckInfo
  created_at: string
  updated_at?: string
}

export interface DedicatedLaneCreate {
  name: string
  pickup_location: string
  delivery_location: string
  miles?: number
  day_of_week: number
  pickup_time?: string
  delivery_time?: string
  rate?: number
  carrier_rate?: number
  fuel_surcharge?: number
  accessorial_charges?: number
  pickup_notes?: string
  delivery_notes?: string
  reference_number?: string
  is_active?: boolean
  customer_id: number
  driver_id?: number
  truck_id?: number
}

export interface PaginatedDedicatedLanes {
  items: DedicatedLane[]
  total: number
  page: number
  limit: number
}

export function useDedicatedLanes(page = 1, limit = 100, activeOnly = true) {
  return useQuery({
    queryKey: ['dedicated-lanes', page, limit, activeOnly],
    queryFn: async (): Promise<PaginatedDedicatedLanes> => {
      const response = await api.get(`/v1/dedicated-lanes/?skip=${(page - 1) * limit}&limit=${limit}&active_only=${activeOnly}`)
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

export function useDedicatedLane(id: number) {
  return useQuery({
    queryKey: ['dedicated-lane', id],
    queryFn: async (): Promise<DedicatedLane> => {
      const response = await api.get(`/v1/dedicated-lanes/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateDedicatedLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DedicatedLaneCreate): Promise<DedicatedLane> => {
      const response = await api.post('/v1/dedicated-lanes/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-lanes'] })
      toast.success('Dedicated lane created successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create dedicated lane'
      toast.error(message)
    },
  })
}

export function useUpdateDedicatedLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DedicatedLaneCreate> }): Promise<DedicatedLane> => {
      const response = await api.put(`/v1/dedicated-lanes/${id}`, data)
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-lanes'] })
      queryClient.invalidateQueries({ queryKey: ['dedicated-lane', id] })
      toast.success('Dedicated lane updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update dedicated lane'
      toast.error(message)
    },
  })
}

export function useDeleteDedicatedLane() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/v1/dedicated-lanes/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-lanes'] })
      toast.success('Dedicated lane deleted successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete dedicated lane'
      toast.error(message)
    },
  })
}

// Helper to get day name from day_of_week number
export function getDayName(dayOfWeek: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return days[dayOfWeek] || 'Unknown'
}
