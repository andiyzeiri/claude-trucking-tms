'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export interface DriverPayrollSettings {
  id: number
  driver_id: number
  company_id: number
  dispatch_fee_percent: number
  insurance_weekly: number
  parking_weekly: number
  trailer_weekly: number
  misc_weekly: number
  created_at: string
  updated_at?: string
}

export interface DriverPayrollSettingsInput {
  driver_id: number
  dispatch_fee_percent?: number
  insurance_weekly?: number
  parking_weekly?: number
  trailer_weekly?: number
  misc_weekly?: number
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
      const response = await api.put(`/v1/driver-payroll-settings/${driverId}/`, data)
      return response.data
    },
    onSuccess: (_, { driverId }) => {
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings'] })
      queryClient.invalidateQueries({ queryKey: ['driver-payroll-settings', driverId] })
      queryClient.invalidateQueries({ queryKey: ['payroll', 'calculated'] })
      toast.success('Driver settings updated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update driver settings'
      toast.error(message)
    },
  })
}
