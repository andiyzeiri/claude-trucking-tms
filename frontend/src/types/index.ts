export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  name?: string // For backward compatibility
  is_active: boolean
  email_verified: boolean
  email_verified_at?: string
  role: string
  company_id: number
  page_permissions?: { pages: string[] }
  allowed_pages?: string[]
  created_at?: string
  updated_at?: string
}

export interface Customer {
  id: number
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface Driver {
  id: number
  first_name: string
  last_name: string
  license_number: string
  phone?: string
  email?: string
  status: 'available' | 'on_trip' | 'off_duty'
  created_at: string
  updated_at: string
}

export interface Truck {
  id: number
  type: 'truck' | 'trailer'
  truck_number: string
  make?: string
  model?: string
  year?: number
  vin?: string
  license_plate?: string
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service'
  created_at: string
  updated_at: string
}

export interface Load {
  id: number
  load_number: string
  customer_id: number
  customer?: Customer
  driver_id?: number
  driver?: Driver
  truck_id?: number
  truck?: Truck
  pickup_location: string
  pickup_date: string
  delivery_location: string
  delivery_date: string
  weight?: number
  miles?: number
  rate: number
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled'
  notes?: string
  pod_url?: string
  ratecon_url?: string
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  date: string
  category: string
  description?: string
  amount: number
  vendor?: string
  payment_method?: string
  receipt_number?: string
  driver_id?: number
  driver?: Driver
  truck_id?: number
  truck?: Truck
  load_id?: number
  company_id: number
  created_at: string
  updated_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}