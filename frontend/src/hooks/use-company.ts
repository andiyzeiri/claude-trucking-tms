'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface Company {
  id: number
  name: string
  mc_number?: string
  dot_number?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
}

export interface CompanyUpdate {
  name?: string
  mc_number?: string
  dot_number?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
}

export function useCompany() {
  const queryClient = useQueryClient()

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async (): Promise<Company> => {
      const response = await api.get('/v1/companies/me')
      return response.data
    },
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyUpdate): Promise<Company> => {
      const response = await api.put('/v1/companies/me', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['company'], data)
      toast.success('Company information updated successfully!')
    },
    onError: (error: any) => {
      const message = typeof error.response?.data?.detail === 'string'
        ? error.response.data.detail
        : 'Failed to update company information'
      toast.error(message)
    },
  })

  return {
    company,
    isLoading,
    updateCompany: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  }
}
