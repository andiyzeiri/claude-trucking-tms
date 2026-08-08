'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  Home,
  Package,
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
  CalendarDays,
  BookOpen
} from 'lucide-react'

// Navigation items with page IDs that match the permissions system
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, pageId: 'dashboard' },
  { name: 'Dispatch Board', href: '/dispatch', icon: CalendarDays, pageId: 'dispatch' },
  { name: 'Loads', href: '/loads', icon: Package, pageId: 'loads' },
  { name: 'Brokerage', href: '/brokerage', icon: Building2, pageId: 'brokerage' },
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
  { name: 'Accounting', href: '/accounting', icon: BookOpen, pageId: 'accounting' },
  { name: 'Users', href: '/users', icon: Shield, pageId: 'users' },
  { name: 'Settings', href: '/settings', icon: Settings, pageId: 'settings' },
]

// Default pages for each role
const ROLE_PAGES: Record<string, string[]> = {
  company_admin: navigation.map(n => n.pageId),
  super_admin: navigation.map(n => n.pageId),
  dispatcher: ['dashboard', 'dispatch', 'loads', 'brokerage', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'expenses', 'fuel', 'payroll', 'invoices', 'reports'],
  driver: ['dashboard', 'loads'],
  customer: ['dashboard', 'loads', 'invoices'],
  viewer: ['dashboard', 'dispatch', 'loads', 'brokerage', 'trucks', 'drivers', 'customers', 'fuel', 'invoices', 'reports'],
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
    <div
      className="sidebar flex h-full w-60 flex-col"
      style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo/Brand */}
      <div className="flex h-16 items-center justify-start px-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--monday-cornflower)' }}
          >
            <Truck className="h-4 w-4 text-white" />
          </div>
          <div className="text-left leading-tight">
            <div className="text-[15px] font-semibold tracking-wide text-white">ABSOLUTE</div>
            <div className="text-[10px] text-white/45">Transportation Management</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          // Active item is a solid blue pill, per the reference design.
          // White on that blue is 5.17:1; inactive labels sit at 70% white
          // on the dark chrome, which is 9.1:1.
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group flex items-center px-3 py-2 text-sm rounded-lg transition-colors nav-item',
                isActive ? 'active font-medium' : 'font-normal hover:bg-white/[0.07]'
              )}
              style={isActive ? {
                backgroundColor: 'var(--monday-cornflower)',
                color: '#FFFFFF'
              } : {
                color: 'rgba(255,255,255,0.70)'
              }}
            >
              <Icon
                className="mr-3 h-[18px] w-[18px] flex-shrink-0"
                style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {user && (
          <div className="flex items-center gap-3 mb-2 px-1">
            <div className="flex-shrink-0">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--monday-cornflower)' }}
              >
                <span className="text-xs font-semibold text-white">
                  {user.first_name?.[0]?.toUpperCase() || ''}{user.last_name?.[0]?.toUpperCase() || ''}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user.first_name ? user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1).toLowerCase() : ''} {user.last_name ? user.last_name.charAt(0).toUpperCase() + user.last_name.slice(1).toLowerCase() : ''}
              </p>
              <p className="truncate text-xs capitalize text-white/45">
                {user.role?.replace('_', ' ') || ''}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-normal transition-colors hover:bg-white/[0.07]"
          style={{ color: 'rgba(255,255,255,0.70)' }}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}