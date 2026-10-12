'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface DriverPayrollSettings {
  id: number
  driver_id: number
  company_id: number
  truck_id?: number | null
  pay_type?: string
  pay_rate?: number
  dispatch_fee_percent: number
  insurance_weekly: number
  parking_weekly: number
  trailer_weekly: number
  misc_weekly: number
  // Company drivers' Pay Structure row on Payroll (null = paid Gross as before).
  // Money arrives as decimal strings or numbers; read with Number().
  pay_structure?: PayStructure | null
  pay_fixed?: number | string | null
  pay_per_mile?: number | string | null
  pay_percent?: number | string | null
  created_at: string
  updated_at?: string
}

export interface DriverPayrollSettingsInput {
  driver_id: number
  truck_id?: number | null
  pay_type?: string
  pay_rate?: number
  dispatch_fee_percent?: number
  insurance_weekly?: number
  parking_weekly?: number
  trailer_weekly?: number
  misc_weekly?: number
  pay_structure?: PayStructure | null
  pay_fixed?: number | null
  pay_per_mile?: number | null
  pay_percent?: number | null
}

export type PayStructure = 'fixed' | 'per_mile' | 'percent'

// Dated pay rates per driver, oldest first (backend app/services/pay_rates.py).
// A changed rate applies from the week it was changed; a pay week uses the
// latest version dated on or before its Sunday. Drivers with none use their
// current settings for every week.
export type RateVersion = { effective_from: string } & Partial<Record<
  'dispatch_fee_percent' | 'insurance_weekly' | 'parking_weekly' | 'trailer_weekly' | 'misc_weekly' |
  'pay_structure' | 'pay_fixed' | 'pay_per_mile' | 'pay_percent', string | null>>

export function useDriverRateVersions() {
  return useQuery<Record<string, RateVersion[]>>({
    queryKey: ['driver-pay-rate-versions'],
    queryFn: async () => (await api.get('/v1/driver-payroll-settings/rate-versions')).data,
    retry: false,
  })
}

// Get all driver payroll settings
export function useDriverPayrollSettings() {
  return useQuery({
    queryKey: ['driver-payroll-settings'],
    queryFn: async (): Promise<DriverPayrollSettings[]> => {
      const response = await api.get('/v1/driver-payroll-settings/')
      return response.data
    },
    retry: false,
  })
}

// Get settings for a specific driver
export function useDriverPayrollSetting(driverId: number) {
  return useQuery({
    queryKey: ['driver-payroll-settings', driverId],
    queryFn: async (): Promise<DriverPayrollSettings> => {
      const response = await api.get(`/v1/driver-payroll-settings/${driverId}`)
      return response.data
    },
    enabled: !!driverId,
    retry: false,
  })
}

// Create or update driver payroll settings
export function useCreateOrUpdateDriverPayrollSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DriverPayrollSettingsInput): Promise<DriverPayrollSettings> => {
      const response = await api.post('/v1/driver-payroll-settings/', data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings'] })
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings', variables.driver_id] })
      queryClient.invalidateQueries({ queryKey: ['payroll', 'calculated'] })
      queryClient.invalidateQueries({ queryKey: ['driver-debts'] }) // fixed amounts feed unpaid-week debt
      queryClient.invalidateQueries({ queryKey: ['driver-pay-rate-versions'] })
      toast.success('Driver settings updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update driver settings'
      toast.error(message)
    },
  })
}

// Update driver payroll settings
export function useUpdateDriverPayrollSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      driverId,
      data
    }: {
      driverId: number
      data: Partial<DriverPayrollSettingsInput>
    }): Promise<DriverPayrollSettings> => {
      const response = await api.put(`/v1/driver-payroll-settings/${driverId}`, data)
      return response.data
    },
    onSuccess: (_, { driverId }) => {
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings'] })
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings', driverId] })
      queryClient.invalidateQueries({ queryKey: ['payroll', 'calculated'] })
      queryClient.invalidateQueries({ queryKey: ['driver-debts'] }) // fixed amounts feed unpaid-week debt
      queryClient.invalidateQueries({ queryKey: ['driver-pay-rate-versions'] })
      toast.success('Driver settings updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update driver settings'
      toast.error(message)
    },
  })
}
