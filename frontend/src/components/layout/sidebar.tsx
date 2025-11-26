'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { ConditionalRender } from '@/components/auth/ProtectedRoute'
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
  Fuel as FuelIcon
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, permissions: [] },
  { name: 'Loads', href: '/loads', icon: Package, permissions: ['can_view_loads'] },
  { name: 'Lanes', href: '/lanes', icon: Route, permissions: ['can_view_loads'] },
  { name: 'Equipment', href: '/trucks', icon: Truck, permissions: ['can_view_trucks'] },
  { name: 'Drivers', href: '/drivers', icon: Users, permissions: ['can_view_drivers'] },
  { name: 'Customers', href: '/customers', icon: Building2, permissions: ['can_view_customers'] },
  { name: 'Shippers', href: '/shippers', icon: Warehouse, permissions: [] },
  { name: 'Receivers', href: '/receivers', icon: Warehouse, permissions: [] },
  { name: 'Expenses', href: '/expenses', icon: Receipt, permissions: [] },
  { name: 'Fuel', href: '/fuel', icon: FuelIcon, permissions: [] },
  { name: 'Payroll', href: '/payroll', icon: Calculator, permissions: [] },
  { name: 'Invoices', href: '/invoices', icon: FileText, permissions: ['can_view_invoices'] },
  { name: 'Ratecons', href: '/ratecons', icon: Receipt, permissions: [] },
  { name: 'Reports', href: '/reports', icon: DollarSign, permissions: ['can_view_reports'] },
  { name: 'Settings', href: '/settings', icon: Settings, permissions: [] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/auth/login'
  }

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
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <ConditionalRender
              key={item.name}
              user={user}
              permissions={item.permissions}
            >
              <Link
                href={item.href}
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
            </ConditionalRender>
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