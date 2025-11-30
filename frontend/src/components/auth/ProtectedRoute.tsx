'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Default pages for each role - must match sidebar.tsx
const ROLE_PAGES: Record<string, string[]> = {
  company_admin: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'expenses', 'fuel', 'payroll', 'invoices', 'ratecons', 'reports', 'users', 'settings'],
  super_admin: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'expenses', 'fuel', 'payroll', 'invoices', 'ratecons', 'reports', 'users', 'settings'],
  dispatcher: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'invoices', 'reports'],
  driver: ['dashboard', 'loads'],
  customer: ['dashboard', 'loads', 'invoices'],
  viewer: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'invoices', 'reports'],
  custom: [],
}

// Get allowed pages for a user based on custom permissions or role defaults
export function getAllowedPages(user: any): string[] {
  if (!user) return []

  // First priority: use page_permissions if set (works for any role)
  if (user.page_permissions?.pages && user.page_permissions.pages.length > 0) {
    return user.page_permissions.pages
  }

  // Second priority: use allowed_pages from backend if available
  if (user.allowed_pages && user.allowed_pages.length > 0) {
    return user.allowed_pages
  }

  // Fallback to role-based defaults
  const roleLower = user.role?.toLowerCase() || 'viewer'
  return ROLE_PAGES[roleLower] || ROLE_PAGES.viewer
}

// Map URL paths to page IDs
function getPageIdFromPath(pathname: string): string | null {
  // Remove leading slash and get first segment
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'dashboard'

  const firstSegment = segments[0]

  // Map common paths to page IDs
  const pathMap: Record<string, string> = {
    'dashboard': 'dashboard',
    'loads': 'loads',
    'lanes': 'lanes',
    'trucks': 'trucks',
    'drivers': 'drivers',
    'customers': 'customers',
    'shippers': 'shippers',
    'receivers': 'receivers',
    'expenses': 'expenses',
    'fuel': 'fuel',
    'payroll': 'payroll',
    'invoices': 'invoices',
    'ratecons': 'ratecons',
    'reports': 'reports',
    'users': 'users',
    'settings': 'settings',
  }

  return pathMap[firstSegment] || null
}

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  fallback?: React.ReactNode
}

export const ProtectedRoute = ({
  children,
  requireAuth = true,
  fallback = <div className="flex items-center justify-center min-h-screen">Access Denied</div>
}: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      router.push('/login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, requireAuth])

  // Check page access after auth is confirmed
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const pageId = getPageIdFromPath(pathname)
      if (pageId) {
        const allowedPages = getAllowedPages(user)
        if (!allowedPages.includes(pageId)) {
          // Redirect to dashboard if user doesn't have access to this page
          router.push('/dashboard')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, user, pathname])

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirect to login if authentication required
  if (requireAuth && !isAuthenticated) {
    return null // Will redirect in useEffect
  }

  // Check page access
  if (user) {
    const pageId = getPageIdFromPath(pathname)
    if (pageId) {
      const allowedPages = getAllowedPages(user)
      if (!allowedPages.includes(pageId)) {
        return null // Will redirect in useEffect
      }
    }
  }

  return <>{children}</>
}

// Helper component for conditional rendering based on permissions
interface ConditionalRenderProps {
  user: any
  permissions?: string[]
  roles?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const ConditionalRender = ({
  user,
  permissions = [],
  roles = [],
  children,
  fallback = null
}: ConditionalRenderProps) => {
  // If no permissions or roles specified, just render children
  if (permissions.length === 0 && roles.length === 0) {
    return <>{children}</>
  }

  // Check if user exists
  if (!user) {
    return <>{fallback}</>
  }

  // Super admins and company admins have all permissions
  if (user.role === 'super_admin' || user.role === 'company_admin') {
    return <>{children}</>
  }

  // Check roles if specified
  if (roles.length > 0) {
    const hasAllowedRole = roles.includes(user.role)
    if (!hasAllowedRole) {
      return <>{fallback}</>
    }
  }

  // Check permissions if specified
  if (permissions.length > 0 && user.permissions) {
    const hasPermission = permissions.some(
      (permission) => user.permissions[permission] === true
    )
    if (!hasPermission) {
      return <>{fallback}</>
    }
  }

  // Check allowed_pages for page access
  if (permissions.length > 0 && !user.permissions) {
    // Fallback to role-based check if permissions not loaded
    // Admins already handled above
    const rolePermissions: Record<string, string[]> = {
      'dispatcher': ['can_view_loads', 'can_create_loads', 'can_edit_loads', 'can_delete_loads', 'can_view_drivers', 'can_manage_drivers', 'can_view_trucks', 'can_manage_trucks', 'can_view_customers', 'can_view_invoices', 'can_view_reports'],
      'driver': ['can_view_loads'],
      'customer': ['can_view_loads', 'can_view_invoices'],
      'viewer': ['can_view_loads', 'can_view_drivers', 'can_view_trucks', 'can_view_customers', 'can_view_invoices', 'can_view_reports'],
    }

    const userRolePermissions = rolePermissions[user.role] || []
    const hasPermission = permissions.some(p => userRolePermissions.includes(p))
    if (!hasPermission) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}
