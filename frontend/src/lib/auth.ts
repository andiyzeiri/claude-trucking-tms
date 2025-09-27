import Cookies from 'js-cookie'
import { api } from './api'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  company_id: number
  is_active: boolean
  is_superuser: boolean
  permissions: Record<string, boolean>
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export const auth = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Use demo login endpoint for now
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)

    const response = await api.post('/demo/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    const { access_token } = response.data

    // Create demo user based on email for role-based testing
    let role = 'viewer'
    let permissions = {}

    if (email.includes('admin')) {
      role = 'company_admin'
      permissions = {
        can_view_loads: true,
        can_create_loads: true,
        can_edit_loads: true,
        can_delete_loads: true,
        can_view_drivers: true,
        can_manage_drivers: true,
        can_view_trucks: true,
        can_manage_trucks: true,
        can_view_customers: true,
        can_manage_customers: true,
        can_view_invoices: true,
        can_manage_invoices: true,
        can_view_reports: true,
        can_manage_users: true,
        can_manage_company: true
      }
    } else if (email.includes('dispatcher')) {
      role = 'dispatcher'
      permissions = {
        can_view_loads: true,
        can_create_loads: true,
        can_edit_loads: true,
        can_view_drivers: true,
        can_manage_drivers: true,
        can_view_trucks: true,
        can_manage_trucks: true,
        can_view_customers: true,
        can_view_invoices: true,
        can_view_reports: true
      }
    } else if (email.includes('driver')) {
      role = 'driver'
      permissions = {
        can_view_loads: true
      }
    } else if (email.includes('customer')) {
      role = 'customer'
      permissions = {
        can_view_loads: true,
        can_view_invoices: true
      }
    }

    const user: User = {
      id: 1,
      email: email,
      first_name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      last_name: 'User',
      role: role,
      company_id: 1,
      is_active: true,
      is_superuser: email.includes('super'),
      permissions: permissions
    }

    // Store token in cookie
    Cookies.set('auth-token', access_token, {
      expires: 7, // 7 days
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    })

    return { user, token: access_token }
  },

  async logout(): Promise<void> {
    Cookies.remove('auth-token')
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      // For demo purposes, return user based on stored token
      const token = this.getToken()
      if (!token) return null

      // Try to get from demo endpoint first
      const response = await api.get('/demo/auth/me')
      const userData = response.data

      // Enhance with permissions based on email pattern
      let permissions = {}
      if (userData.email?.includes('admin')) {
        permissions = {
          can_view_loads: true, can_create_loads: true, can_edit_loads: true, can_delete_loads: true,
          can_view_drivers: true, can_manage_drivers: true, can_view_trucks: true, can_manage_trucks: true,
          can_view_customers: true, can_manage_customers: true, can_view_invoices: true, can_manage_invoices: true,
          can_view_reports: true, can_manage_users: true, can_manage_company: true
        }
      } else if (userData.email?.includes('dispatcher')) {
        permissions = {
          can_view_loads: true, can_create_loads: true, can_edit_loads: true,
          can_view_drivers: true, can_manage_drivers: true, can_view_trucks: true, can_manage_trucks: true,
          can_view_customers: true, can_view_invoices: true, can_view_reports: true
        }
      } else if (userData.email?.includes('driver')) {
        permissions = { can_view_loads: true }
      } else if (userData.email?.includes('customer')) {
        permissions = { can_view_loads: true, can_view_invoices: true }
      }

      return {
        ...userData,
        role: userData.email?.includes('admin') ? 'company_admin' :
              userData.email?.includes('dispatcher') ? 'dispatcher' :
              userData.email?.includes('driver') ? 'driver' :
              userData.email?.includes('customer') ? 'customer' : 'viewer',
        permissions,
        is_superuser: userData.email?.includes('super') || false,
        is_active: true
      }
    } catch (error) {
      console.warn('Failed to get current user:', error)
      return null
    }
  },

  getToken(): string | undefined {
    return Cookies.get('auth-token')
  },

  isAuthenticated(): boolean {
    return !!this.getToken()
  }
}

// Permission helpers
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false
  if (user.is_superuser) return true
  return user.permissions[permission] || false
}

export const canViewLoads = (user: User | null): boolean =>
  hasPermission(user, 'can_view_loads')

export const canCreateLoads = (user: User | null): boolean =>
  hasPermission(user, 'can_create_loads')

export const canEditLoads = (user: User | null): boolean =>
  hasPermission(user, 'can_edit_loads')

export const canDeleteLoads = (user: User | null): boolean =>
  hasPermission(user, 'can_delete_loads')

export const canManageUsers = (user: User | null): boolean =>
  hasPermission(user, 'can_manage_users')

export const canManageDrivers = (user: User | null): boolean =>
  hasPermission(user, 'can_manage_drivers')

export const canManageTrucks = (user: User | null): boolean =>
  hasPermission(user, 'can_manage_trucks')

export const canManageCustomers = (user: User | null): boolean =>
  hasPermission(user, 'can_manage_customers')

export const canViewReports = (user: User | null): boolean =>
  hasPermission(user, 'can_view_reports')

// Role helpers
export const isDriver = (user: User | null): boolean =>
  user?.role === 'driver'

export const isCustomer = (user: User | null): boolean =>
  user?.role === 'customer'

export const isDispatcher = (user: User | null): boolean =>
  user?.role === 'dispatcher'

export const isCompanyAdmin = (user: User | null): boolean =>
  user?.role === 'company_admin'

export const isSuperAdmin = (user: User | null): boolean =>
  user?.role === 'super_admin' || user?.is_superuser === true