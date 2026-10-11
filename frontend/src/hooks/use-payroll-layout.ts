import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// One line item on the Payroll page (see backend app/models/payroll_layout.py).
//   kind: earning adds to net pay, deduction subtracts, info (miles) is shown only
//   mode: auto = calculated from loads / fuel cards, fixed = same weekly amount
//         every week (per driver), variable = entered week by week
export interface PayrollRow {
  key: string
  label: string
  kind: 'earning' | 'deduction' | 'info'
  mode: 'auto' | 'fixed' | 'variable'
  hidden: boolean
  builtin: boolean
  amounts: Record<string, number> // driver_id -> weekly amount, fixed custom rows only
}

// Built-in rows whose mode can be switched between fixed and variable.
export const SWITCHABLE_ROWS = new Set(['insurance', 'parking', 'trailer', 'misc'])

// Company drivers, owner operators and company owners each have their own rows.
export type PayrollDriverType = 'company' | 'owner_operator' | 'company_owner'

export const layoutKey = (driverType: PayrollDriverType) => ['payroll-layout', driverType]

export function usePayrollLayout(driverType: PayrollDriverType) {
  return useQuery<PayrollRow[]>({
    queryKey: layoutKey(driverType),
    queryFn: async () => (await api.get(`/v1/payroll-layout/?driver_type=${driverType}`)).data.rows,
  })
}

export function useSavePayrollLayout(driverType: PayrollDriverType) {
  const queryClient = useQueryClient()
  const LAYOUT_KEY = layoutKey(driverType)
  return useMutation({
    mutationFn: async (rows: PayrollRow[]): Promise<PayrollRow[]> =>
      (await api.put(`/v1/payroll-layout/?driver_type=${driverType}`, { rows })).data.rows,
    onMutate: async (rows) => {
      await queryClient.cancelQueries({ queryKey: LAYOUT_KEY })
      const previous = queryClient.getQueryData<PayrollRow[]>(LAYOUT_KEY)
      queryClient.setQueryData(LAYOUT_KEY, rows)
      return { previous }
    },
    onError: (error: any, _rows, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(LAYOUT_KEY, ctx.previous)
      toast.error(error.response?.data?.detail || 'Could not save payroll rows')
    },
    onSuccess: (rows) => {
      queryClient.setQueryData(LAYOUT_KEY, rows)
      queryClient.invalidateQueries({ queryKey: ['driver-debts'] }) // hiding Debt Payment stops payroll payments
    },
  })
}

// Left-to-right order of the driver columns, per table (dragged on the page).
const orderKey = (driverType: PayrollDriverType) => ['payroll-driver-order', driverType]

export function useDriverOrder(driverType: PayrollDriverType) {
  return useQuery<number[]>({
    queryKey: orderKey(driverType),
    queryFn: async () => (await api.get(`/v1/payroll-layout/driver-order?driver_type=${driverType}`)).data.driver_order,
  })
}

export function useSaveDriverOrder(driverType: PayrollDriverType) {
  const queryClient = useQueryClient()
  const key = orderKey(driverType)
  return useMutation({
    mutationFn: async (order: number[]): Promise<number[]> =>
      (await api.put(`/v1/payroll-layout/driver-order?driver_type=${driverType}`, { driver_order: order })).data.driver_order,
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<number[]>(key)
      queryClient.setQueryData(key, order)
      return { previous }
    },
    onError: (_e, _order, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
      toast.error('Could not save the driver order')
    },
  })
}
