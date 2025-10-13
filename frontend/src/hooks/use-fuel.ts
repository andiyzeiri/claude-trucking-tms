import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Fuel } from '@/types'
import { toast } from 'sonner'

interface FuelFormData {
  date: string
  location?: string
  gallons: number
  price_per_gallon?: number
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
      const response = await api.get('/fuel')
      return response.data
    }
  })
}

export function useFuelEntry(id: number) {
  return useQuery<Fuel>({
    queryKey: ['fuel', id],
    queryFn: async () => {
      const response = await api.get(`/fuel/${id}`)
      return response.data
    },
    enabled: !!id
  })
}

export function useCreateFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FuelFormData) => {
      const response = await api.post('/fuel', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create fuel entry')
    }
  })
}

export function useUpdateFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FuelFormData> }) => {
      const response = await api.put(`/fuel/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update fuel entry')
    }
  })
}

export function useDeleteFuel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/fuel/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel'] })
      toast.success('Fuel entry deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete fuel entry')
    }
  })
}
