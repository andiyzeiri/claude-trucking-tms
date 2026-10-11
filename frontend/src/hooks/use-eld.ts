import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// Peak ELD integration (backend app/api/v1/endpoints/eld.py).
// The API key only ever goes up; the server sends back its last 4 characters.
export interface EldConnection {
  connected: boolean
  provider: string | null
  key_last4: string | null
  last_ok_at: string | null
  last_error: string | null
}

export interface VehicleMiles {
  eld_id: string
  unit: string
  vin: string | null
  active: boolean
  miles: number
  truck_id: number | null
  truck_number: string | null
  driver_name: string | null
  matched_by: 'manual' | 'unit' | 'vin' | null
}

export interface MileageReport {
  start: string
  end: string
  total_miles: number
  vehicles: VehicleMiles[]
  trucks: { id: number; truck_number: string }[]
}

export interface StateMiles {
  state: string
  miles: number
}

export interface StatesReport {
  start: string
  end: string
  total_miles: number
  states: StateMiles[]
  by_vehicle: Record<string, StateMiles[]>
}

const CONNECTION_KEY = ['eld-connection']
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
const errorText = (error: any, fallback: string) => error?.response?.data?.detail?.toString?.() || fallback

export function useEldConnection() {
  return useQuery<EldConnection>({
    queryKey: CONNECTION_KEY,
    queryFn: async () => (await api.get('/v1/eld/connection')).data,
  })
}

export function useConnectEld() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (apiKey: string): Promise<EldConnection> =>
      (await api.put('/v1/eld/connection', { api_key: apiKey })).data,
    onSuccess: (conn) => {
      queryClient.setQueryData(CONNECTION_KEY, conn)
      queryClient.invalidateQueries({ queryKey: ['eld-mileage'] })
      toast.success('Peak ELD connected')
    },
    onError: (error: any) => toast.error(errorText(error, 'Could not connect Peak ELD')),
  })
}

export function useDisconnectEld() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<EldConnection> => (await api.delete('/v1/eld/connection')).data,
    onSuccess: (conn) => {
      queryClient.setQueryData(CONNECTION_KEY, conn)
      queryClient.removeQueries({ queryKey: ['eld-mileage'] })
      toast.success('Peak ELD disconnected')
    },
    onError: (error: any) => toast.error(errorText(error, 'Could not disconnect')),
  })
}

export function useEldMileage(start: string, end: string, enabled: boolean) {
  return useQuery<MileageReport>({
    queryKey: ['eld-mileage', 'trucks', start, end],
    queryFn: async () => (await api.get('/v1/eld/mileage', { params: { start, end, tz: tz() } })).data,
    enabled: enabled && !!start && !!end,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useEldStateMiles(start: string, end: string, enabled: boolean) {
  return useQuery<StatesReport>({
    queryKey: ['eld-mileage', 'states', start, end],
    queryFn: async () => (await api.get('/v1/eld/mileage/states', { params: { start, end, tz: tz() } })).data,
    enabled: enabled && !!start && !!end,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetEldTruckMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { eld_id: string; truck_id: number | null }) =>
      (await api.put('/v1/eld/truck-map', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eld-mileage', 'trucks'] }),
    onError: (error: any) => toast.error(errorText(error, 'Could not save the truck match')),
  })
}
