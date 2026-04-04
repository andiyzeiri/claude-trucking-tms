import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PayrollOverride {
  id: number
  driver_id: number
  company_id: number
  year: number
  week_number: number
  field: string
  value: number
}

export function usePayrollOverrides(year: number) {
  return useQuery<PayrollOverride[]>({
    queryKey: ['payroll-overrides', year],
    queryFn: async () => {
      const response = await api.get(`/v1/payroll-overrides/?year=${year}`)
      return response.data
    }
  })
}

export function useSavePayrollOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { driver_id: number; year: number; week_number: number; field: string; value: number }) => {
      const response = await api.post('/v1/payroll-overrides/', data)
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-overrides', variables.year] })
      if (variables.field === 'truck_id') {
        queryClient.invalidateQueries({ queryKey: ['payroll', 'calculated'] })
      }
    }
  })
}
