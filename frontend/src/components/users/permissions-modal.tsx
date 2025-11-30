'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { User } from '@/types'
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
  Calculator,
  Receipt,
  Warehouse,
  Fuel,
  Shield
} from 'lucide-react'

// All available pages in the system
const ALL_PAGES = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, description: 'Main dashboard overview' },
  { id: 'loads', name: 'Loads', icon: Package, description: 'Load management & tracking' },
  { id: 'lanes', name: 'Lanes', icon: Route, description: 'Freight lane management' },
  { id: 'trucks', name: 'Equipment', icon: Truck, description: 'Trucks and trailers' },
  { id: 'drivers', name: 'Drivers', icon: Users, description: 'Driver roster management' },
  { id: 'customers', name: 'Customers', icon: Building2, description: 'Customer relationships' },
  { id: 'shippers', name: 'Shippers', icon: Warehouse, description: 'Shipper locations' },
  { id: 'receivers', name: 'Receivers', icon: Warehouse, description: 'Receiver locations' },
  { id: 'expenses', name: 'Expenses', icon: Receipt, description: 'Operating expenses' },
  { id: 'fuel', name: 'Fuel', icon: Fuel, description: 'Fuel expense tracking' },
  { id: 'payroll', name: 'Payroll', icon: Calculator, description: 'Driver payroll management' },
  { id: 'invoices', name: 'Invoices', icon: FileText, description: 'Invoice generation' },
  { id: 'ratecons', name: 'Ratecons', icon: Receipt, description: 'Rate confirmations' },
  { id: 'reports', name: 'Reports', icon: DollarSign, description: 'Analytics & reporting' },
  { id: 'users', name: 'Users', icon: Shield, description: 'User management' },
  { id: 'settings', name: 'Settings', icon: Settings, description: 'System settings' },
]

// Default pages for each role
const ROLE_PAGES: Record<string, string[]> = {
  company_admin: ALL_PAGES.map(p => p.id),
  super_admin: ALL_PAGES.map(p => p.id),
  dispatcher: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'invoices', 'reports'],
  driver: ['dashboard', 'loads'],
  customer: ['dashboard', 'loads', 'invoices'],
  viewer: ['dashboard', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'invoices', 'reports'],
  custom: [],
}

interface PermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userId: number, permissions: { pages: string[] }) => void
  user: User | null
}

export function PermissionsModal({ isOpen, onClose, onSave, user }: PermissionsModalProps) {
  const [enabledPages, setEnabledPages] = useState<string[]>([])
  const [isCustom, setIsCustom] = useState(false)

  useEffect(() => {
    if (user) {
      const isCustomRole = user.role === 'custom'
      setIsCustom(isCustomRole)

      if (isCustomRole && user.page_permissions?.pages) {
        setEnabledPages(user.page_permissions.pages)
      } else {
        // Get default pages for the role
        const roleLower = user.role?.toLowerCase() || 'viewer'
        setEnabledPages(ROLE_PAGES[roleLower] || ROLE_PAGES.viewer)
      }
    }
  }, [user, isOpen])

  const togglePage = (pageId: string) => {
    setEnabledPages(prev =>
      prev.includes(pageId)
        ? prev.filter(p => p !== pageId)
        : [...prev, pageId]
    )
  }

  const handleSave = () => {
    if (user) {
      onSave(user.id, { pages: enabledPages })
    }
  }

  const handleSelectAll = () => {
    setEnabledPages(ALL_PAGES.map(p => p.id))
  }

  const handleSelectNone = () => {
    setEnabledPages(['dashboard']) // Always keep dashboard
  }

  if (!user) return null

  const roleName = user.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Page Access for {user.first_name} {user.last_name}
          </DialogTitle>
          <DialogDescription>
            {isCustom
              ? 'Configure which pages this user can access.'
              : `This user has the "${roleName}" role. To customize permissions, change their role to "Custom" first.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isCustom && (
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectNone}>
                Select None
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {ALL_PAGES.map((page) => {
              const Icon = page.icon
              const isEnabled = enabledPages.includes(page.id)
              const isDashboard = page.id === 'dashboard'

              return (
                <div
                  key={page.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isEnabled
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-background'
                  } ${!isCustom ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${
                      isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <Label className="font-medium cursor-pointer">{page.name}</Label>
                      <p className="text-xs text-muted-foreground">{page.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => togglePage(page.id)}
                    disabled={!isCustom || isDashboard}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isCustom}>
            {isCustom ? 'Save Permissions' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
