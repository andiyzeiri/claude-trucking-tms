'use client'

import { useAuth } from '@/hooks/useAuth'
import { hasPermission, User } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requiredPermissions?: string[]
  allowedRoles?: string[]
  fallback?: React.ReactNode
}

export const ProtectedRoute = ({
  children,
  requireAuth = true,
  requiredPermissions = [],
  allowedRoles = [],
  fallback = <div>Access Denied</div>
}: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, requireAuth, router])

  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>
  }

  // Redirect to login if authentication required
  if (requireAuth && !isAuthenticated) {
    return null // Will redirect in useEffect
  }

  // Check permissions
  if (user && requiredPermissions.length > 0) {
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      hasPermission(user, permission)
    )
    if (!hasRequiredPermissions) {
      return <>{fallback}</>
    }
  }

  // Check roles
  if (user && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.includes(user.role)
    if (!hasAllowedRole) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}

interface ConditionalRenderProps {
  user: User | null
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
  // Check permissions
  if (permissions.length > 0) {
    const hasRequiredPermissions = permissions.every(permission =>
      hasPermission(user, permission)
    )
    if (!hasRequiredPermissions) {
      return <>{fallback}</>
    }
  }

  // Check roles
  if (roles.length > 0 && user) {
    const hasAllowedRole = roles.includes(user.role)
    if (!hasAllowedRole) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}