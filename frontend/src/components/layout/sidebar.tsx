'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  Home,
  Package,
  Route,
  Truck,
  Users,
  Building2,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  Calculator,
  Receipt,
  Warehouse,
  Fuel as FuelIcon,
  Shield,
  CalendarDays
} from 'lucide-react'

// Navigation items with page IDs that match the permissions system
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, pageId: 'dashboard' },
  { name: 'Dispatch Board', href: '/dispatch', icon: CalendarDays, pageId: 'dispatch' },
  { name: 'Loads', href: '/loads', icon: Package, pageId: 'loads' },
  { name: 'Brokerage', href: '/brokerage', icon: Building2, pageId: 'brokerage' },
  { name: 'Lanes', href: '/lanes', icon: Route, pageId: 'lanes' },
  { name: 'Equipment', href: '/trucks', icon: Truck, pageId: 'trucks' },
  { name: 'Drivers', href: '/drivers', icon: Users, pageId: 'drivers' },
  { name: 'Customers', href: '/customers', icon: Building2, pageId: 'customers' },
  { name: 'Shippers', href: '/shippers', icon: Warehouse, pageId: 'shippers' },
  { name: 'Receivers', href: '/receivers', icon: Warehouse, pageId: 'receivers' },
  { name: 'Expenses', href: '/expenses', icon: Receipt, pageId: 'expenses' },
  { name: 'Fuel', href: '/fuel', icon: FuelIcon, pageId: 'fuel' },
  { name: 'Payroll', href: '/payroll', icon: Calculator, pageId: 'payroll' },
  { name: 'Invoices', href: '/invoices', icon: FileText, pageId: 'invoices' },
  { name: 'Ratecons', href: '/ratecons', icon: Receipt, pageId: 'ratecons' },
  { name: 'Reports', href: '/reports', icon: DollarSign, pageId: 'reports' },
  { name: 'Users', href: '/users', icon: Shield, pageId: 'users' },
  { name: 'Settings', href: '/settings', icon: Settings, pageId: 'settings' },
]

// Default pages for each role
const ROLE_PAGES: Record<string, string[]> = {
  company_admin: navigation.map(n => n.pageId),
  super_admin: navigation.map(n => n.pageId),
  dispatcher: ['dashboard', 'dispatch', 'loads', 'brokerage', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'expenses', 'fuel', 'payroll', 'invoices', 'reports'],
  driver: ['dashboard', 'loads'],
  customer: ['dashboard', 'loads', 'invoices'],
  viewer: ['dashboard', 'dispatch', 'loads', 'brokerage', 'lanes', 'trucks', 'drivers', 'customers', 'fuel', 'invoices', 'reports'],
  custom: [],
}

// Get allowed pages for a user - backend computes this based on role or custom permissions
function getAllowedPages(user: any): string[] {
  if (!user) return []

  // Use allowed_pages from backend (handles page_permissions logic server-side)
  if (user.allowed_pages && user.allowed_pages.length > 0) {
    return user.allowed_pages
  }

  // Fallback to role-based defaults if backend doesn't provide allowed_pages
  const roleLower = user.role?.toLowerCase() || 'viewer'
  return ROLE_PAGES[roleLower] || ROLE_PAGES.viewer
}

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/auth/login'
  }

  // Get the list of pages this user can access
  const allowedPages = getAllowedPages(user)

  // Filter navigation items based on allowed pages
  const filteredNavigation = navigation.filter(item => allowedPages.includes(item.pageId))

  return (
    <div className="sidebar flex h-full w-60 flex-col" style={{ backgroundColor: 'var(--monday-bg-primary)', borderRight: '1px solid var(--monday-border-light)' }}>
      {/* Logo/Brand */}
      <div className="flex h-16 items-center justify-start px-4" style={{ borderBottom: '1px solid var(--monday-border-light)' }}>
        <div className="text-left">
          <div className="text-xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>ABSOLUTE</div>
          <div className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>Transportation Management System</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors nav-item',
                isActive ? 'active' : ''
              )}
              style={isActive ? {
                backgroundColor: 'rgba(97, 97, 255, 0.1)',
                color: 'var(--monday-cornflower)',
                borderLeft: '3px solid var(--monday-cornflower)'
              } : {
                color: 'var(--monday-text-secondary)'
              }}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" style={{ color: isActive ? 'var(--monday-cornflower)' : 'var(--monday-text-muted)' }} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout */}
      <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--monday-border-light)' }}>
        {user && (
          <div className="flex items-center space-x-3 mb-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(97, 97, 255, 0.1)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--monday-cornflower)' }}>
                  {user.first_name?.[0]?.toUpperCase() || ''}{user.last_name?.[0]?.toUpperCase() || ''}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--monday-text-primary)' }}>
                {user.first_name ? user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1).toLowerCase() : ''} {user.last_name ? user.last_name.charAt(0).toUpperCase() + user.last_name.slice(1).toLowerCase() : ''}
              </p>
              <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>{user.email || ''}</p>
              <p className="text-xs capitalize" style={{ color: 'var(--monday-cornflower)' }}>{user.role?.replace('_', ' ') || ''}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{ color: 'var(--monday-text-secondary)' }}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}