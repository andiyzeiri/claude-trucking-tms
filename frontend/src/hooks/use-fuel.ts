import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Fuel } from '@/types'
import toast from 'react-hot-toast'

// Helper to extract error message from Pydantic validation errors
function getErrorMessage(error: any, fallback: string): string {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation error format: [{loc, msg, type}, ...]
    const firstError = detail[0]
    if (firstError.msg) {
      const field = firstError.loc?.slice(-1)[0] || 'field'
      return `${field}: ${firstError.msg}`
    }
  }
  return fallback
}

interface FuelFormData {
  date: string
  location?: string
  gallons: number
  price_per_gallon?: number
  def_gallons?: number
  def_price?: number
  total_amount: number
  odometer?: number
  notes?: string
  driver_id?: number
  truck_id?: number
  load_id?: number
}

export function useFuel() {
  return useQuery<Fuel[]>({
    queryKey: ['fuel'],
    queryFn: async () => {
      const response = await api.get('/v1/fuel/')
      return response.data
    }
  })
}

export function useFuelEntry(id: number) {
  return useQuery<Fuel>({
    queryKey: ['fuel', id],
    queryFn: async () => {
      const response = await api.get(`/v1/fuel/${id}`)
      return response.data
    },
    enabled: !!id
  })
}

export function useCreateFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FuelFormData) => {
      const response = await api.post('/v1/fuel/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry created successfully')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create fuel entry'))
    }
  })
}

export function useUpdateFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FuelFormData> }) => {
      const response = await api.put(`/v1/fuel/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry updated successfully')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update fuel entry'))
    }
  })
}

export function useDeleteFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/v1/fuel/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry deleted successfully')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete fuel entry'))
    }
  })
}
