'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      router.push('/login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, requireAuth])

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

  // Check roles if specified
  if (roles.length > 0) {
    const hasAllowedRole = roles.includes(user.role)
    if (!hasAllowedRole) {
      return <>{fallback}</>
    }
  }

  // For now, render children (permission checking can be enhanced later)
  // TODO: Implement proper permission checking when backend provides user permissions
  return <>{children}</>
}
