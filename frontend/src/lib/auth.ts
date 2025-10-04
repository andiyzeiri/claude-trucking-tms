import Cookies from 'js-cookie'
import { api } from './api'

export interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  role: string
  company_id?: number
  is_active?: boolean
  is_superuser?: boolean
  permissions?: Record<string, boolean>
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export const auth = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await api.post('/v1/auth/login-json', {
      username_or_email: email,
      password
    })
    const { access_token, user: userData } = response.data

    const user: User = {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      company_id: userData.company_id,
      is_active: userData.is_active,
      is_superuser: userData.role === 'super_admin',
      permissions: userData.permissions || {}
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
      const token = this.getToken()
      if (!token) return null

      // Get current user from API
      const response = await api.get('/v1/users/me')
      const userData = response.data

      return {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        company_id: userData.company_id,
        is_active: userData.is_active,
        is_superuser: userData.role === 'super_admin',
        permissions: userData.permissions || {}
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

  // Admin users have all permissions
  if (user.role === 'admin' || user.role === 'company_admin' || user.role === 'super_admin') {
    return true
  }

  return user.permissions?.[permission] || false
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