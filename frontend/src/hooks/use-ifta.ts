import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export interface IFTA {
  id: number
  year: number
  quarter: number
  jurisdiction: string
  total_miles: number
  taxable_miles: number
  tax_paid_gallons: number
  mpg?: number
  notes?: string
  truck_id?: number
  truck?: {
    id: number
    truck_number: string
    make?: string
    model?: string
  }
  company_id: number
  created_at: string
  updated_at?: string
}

export interface IFTASummary {
  year: number
  quarter: number
  total_miles: number
  total_taxable_miles: number
  total_gallons: number
  overall_mpg?: number
  jurisdiction_count: number
}

interface IFTAFormData {
  year: number
  quarter: number
  jurisdiction: string
  total_miles: number
  taxable_miles: number
  tax_paid_gallons: number
  notes?: string
  truck_id?: number
}

interface IFTAFilters {
  year?: number
  quarter?: number
  truck_id?: number
}

export function useIfta(filters?: IFTAFilters) {
  return useQuery<IFTA[]>({
    queryKey: ['ifta', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.year) params.append('year', filters.year.toString())
      if (filters?.quarter) params.append('quarter', filters.quarter.toString())
      if (filters?.truck_id) params.append('truck_id', filters.truck_id.toString())
      const queryString = params.toString()
      const response = await api.get(`/v1/ifta/${queryString ? '?' + queryString : ''}`)
      return response.data
    }
  })
}

export function useIftaSummary(year: number, quarter: number) {
  return useQuery<IFTASummary>({
    queryKey: ['ifta-summary', year, quarter],
    queryFn: async () => {
      const response = await api.get(`/v1/ifta/summary?year=${year}&quarter=${quarter}`)
      return response.data
    },
    enabled: !!year && !!quarter
  })
}

export function useIftaEntry(id: number) {
  return useQuery<IFTA>({
    queryKey: ['ifta', id],
    queryFn: async () => {
      const response = await api.get(`/v1/ifta/${id}`)
      return response.data
    },
    enabled: !!id
  })
}

export function useCreateIfta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: IFTAFormData) => {
      const response = await api.post('/v1/ifta/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ifta'] })
      queryClient.invalidateQueries({ queryKey: ['ifta-summary'] })
      toast.success('IFTA entry created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create IFTA entry')
    }
  })
}

export function useUpdateIfta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<IFTAFormData> }) => {
      const response = await api.put(`/v1/ifta/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ifta'] })
      queryClient.invalidateQueries({ queryKey: ['ifta-summary'] })
      toast.success('IFTA entry updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update IFTA entry')
    }
  })
}

export function useDeleteIfta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/v1/ifta/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ifta'] })
      queryClient.invalidateQueries({ queryKey: ['ifta-summary'] })
      toast.success('IFTA entry deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete IFTA entry')
    }
  })
}
