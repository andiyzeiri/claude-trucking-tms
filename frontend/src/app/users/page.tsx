'use client'

import React, { useState } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Plus, Users, Edit, Trash2, Shield, UserCheck, UserX, Key, Eye, EyeOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Home,
  Package,
  Route,
  Truck,
  Building2,
  FileText,
  DollarSign,
  Settings,
  Calculator,
  Receipt,
  Warehouse,
  Fuel,
  CalendarDays
} from 'lucide-react'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_active: boolean
  role: string
  company_id: number
  allowed_pages?: string[]
  page_permissions?: { pages: string[] }
}

interface CreateUserData {
  username: string
  email: string
  first_name: string
  last_name: string
  password: string
  role: string
  send_invitation: boolean
}

interface UpdateUserData {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  role?: string
  is_active?: boolean
  password?: string
  page_permissions?: { pages: string[] }
}

const ROLES = [
  { value: 'company_admin', label: 'Company Admin', description: 'Full access to all features' },
  { value: 'dispatcher', label: 'Dispatcher', description: 'Manage loads, drivers, trucks' },
  { value: 'driver', label: 'Driver', description: 'View assigned loads only' },
  { value: 'customer', label: 'Customer', description: 'View own loads and invoices' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'custom', label: 'Custom', description: 'Custom page permissions' },
]

// All available pages in the system
const ALL_PAGES = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, description: 'Main dashboard overview' },
  { id: 'dispatch', name: 'Dispatch Board', icon: CalendarDays, description: 'Weekly driver schedule' },
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
  dispatcher: ['dashboard', 'dispatch', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'shippers', 'receivers', 'invoices', 'reports'],
  driver: ['dashboard', 'loads'],
  customer: ['dashboard', 'loads', 'invoices'],
  viewer: ['dashboard', 'dispatch', 'loads', 'lanes', 'trucks', 'drivers', 'customers', 'invoices', 'reports'],
  custom: [],
}

// Password generator function
const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  // Ensure at least one of each required type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  password += '0123456789'[Math.floor(Math.random() * 10)]
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]
  // Fill remaining characters
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'company_admin' || currentUser?.role === 'super_admin'

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['company-users'],
    queryFn: async () => {
      const response = await api.get('/v1/users/company-users')
      return response.data
    },
    enabled: isAdmin,
  })

  // Mutations
  const createUser = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await api.post('/v1/users/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] })
      toast.success(data.message || 'User created successfully')
      if (data.temporary_password) {
        toast.success(`Temporary password: ${data.temporary_password}`, { duration: 10000 })
      }
      setIsCreateModalOpen(false)
      resetCreateForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateUserData }) => {
      const response = await api.put(`/v1/users/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] })
      toast.success('User updated successfully')
      setIsEditModalOpen(false)
      setEditingUser(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/v1/users/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] })
      toast.success('User deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    },
  })

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [enabledPages, setEnabledPages] = useState<string[]>([])

  // Create form state
  const [createForm, setCreateForm] = useState<CreateUserData>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'viewer',
    send_invitation: false,
  })

  // Edit form state
  const [editForm, setEditForm] = useState<UpdateUserData>({})

  const resetCreateForm = () => {
    setCreateForm({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      role: 'viewer',
      send_invitation: false,
    })
    setShowPassword(false)
  }

  const handleCreateUser = () => {
    if (!createForm.username || !createForm.email || !createForm.first_name || !createForm.last_name) {
      toast.error('Please fill in all required fields')
      return
    }
    if (!createForm.password || createForm.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    // Validate password strength
    if (!/[A-Z]/.test(createForm.password)) {
      toast.error('Password must contain at least one uppercase letter')
      return
    }
    if (!/[a-z]/.test(createForm.password)) {
      toast.error('Password must contain at least one lowercase letter')
      return
    }
    if (!/[0-9]/.test(createForm.password)) {
      toast.error('Password must contain at least one number')
      return
    }
    createUser.mutate(createForm)
  }

  // Open permissions modal
  const handleOpenPermissions = (user: User) => {
    setPermissionsUser(user)
    const isCustomRole = user.role === 'custom'
    if (isCustomRole && user.page_permissions?.pages) {
      setEnabledPages(user.page_permissions.pages)
    } else {
      // Get default pages for the role
      const roleLower = user.role?.toLowerCase() || 'viewer'
      setEnabledPages(ROLE_PAGES[roleLower] || ROLE_PAGES.viewer)
    }
    setIsPermissionsModalOpen(true)
  }

  // Toggle a page permission
  const togglePage = (pageId: string) => {
    setEnabledPages(prev =>
      prev.includes(pageId)
        ? prev.filter(p => p !== pageId)
        : [...prev, pageId]
    )
  }

  // Save permissions
  const handleSavePermissions = () => {
    if (!permissionsUser) return
    updateUser.mutate({
      id: permissionsUser.id,
      data: { page_permissions: { pages: enabledPages } }
    })
    setIsPermissionsModalOpen(false)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    // Get default pages for the user's role or their custom pages
    let userPages: string[]
    if (user.page_permissions?.pages && user.page_permissions.pages.length > 0) {
      userPages = user.page_permissions.pages
    } else {
      const roleLower = user.role?.toLowerCase() || 'viewer'
      userPages = ROLE_PAGES[roleLower] || ROLE_PAGES.viewer
    }
    setEditForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      page_permissions: { pages: userPages },
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = () => {
    if (!editingUser) return
    updateUser.mutate({ id: editingUser.id, data: editForm })
  }

  // Toggle a page in edit form
  const toggleEditPage = (pageId: string) => {
    const currentPages = editForm.page_permissions?.pages || []
    const newPages = currentPages.includes(pageId)
      ? currentPages.filter(p => p !== pageId)
      : [...currentPages, pageId]
    setEditForm({ ...editForm, page_permissions: { pages: newPages } })
  }

  // Select all pages in edit form
  const selectAllEditPages = () => {
    setEditForm({ ...editForm, page_permissions: { pages: ALL_PAGES.map(p => p.id) } })
  }

  // Select none (except dashboard) in edit form
  const selectNoneEditPages = () => {
    setEditForm({ ...editForm, page_permissions: { pages: ['dashboard'] } })
  }

  // Reset to role defaults in edit form
  const resetToRoleDefaults = () => {
    const roleLower = editForm.role?.toLowerCase() || 'viewer'
    const defaultPages = ROLE_PAGES[roleLower] || ROLE_PAGES.viewer
    setEditForm({ ...editForm, page_permissions: { pages: defaultPages } })
  }

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot delete your own account")
      return
    }
    if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
      deleteUser.mutate(user.id)
    }
  }

  const handleToggleActive = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot deactivate your own account")
      return
    }
    updateUser.mutate({
      id: user.id,
      data: { is_active: !user.is_active }
    })
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'company_admin':
      case 'super_admin':
        return 'bg-purple-100 text-purple-800'
      case 'dispatcher':
        return 'bg-brand/10 text-brand'
      case 'driver':
        return 'bg-green-100 text-green-800'
      case 'customer':
        return 'bg-orange-100 text-orange-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    const roleInfo = ROLES.find(r => r.value === role)
    return roleInfo?.label || role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--monday-stuck)' }} />
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--monday-text-primary)' }}>
                  Access Denied
                </h2>
                <p style={{ color: 'var(--monday-text-secondary)' }}>
                  Only administrators can manage users.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--monday-text-primary)' }}>
              User Management
            </h1>
            <p style={{ color: 'var(--monday-text-secondary)' }}>
              Manage users and their access levels
            </p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card style={{ borderColor: 'var(--monday-border-light)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(27, 42, 65, 0.1)' }}>
                  <Users className="h-5 w-5" style={{ color: 'var(--monday-cornflower)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                    {users.length}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderColor: 'var(--monday-border-light)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(0, 200, 117, 0.1)' }}>
                  <UserCheck className="h-5 w-5" style={{ color: 'var(--monday-done)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                    {users.filter(u => u.is_active).length}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderColor: 'var(--monday-border-light)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(226, 68, 92, 0.1)' }}>
                  <UserX className="h-5 w-5" style={{ color: 'var(--monday-stuck)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                    {users.filter(u => !u.is_active).length}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderColor: 'var(--monday-border-light)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(162, 93, 220, 0.1)' }}>
                  <Shield className="h-5 w-5" style={{ color: 'var(--monday-purple)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--monday-text-primary)' }}>
                    {users.filter(u => u.role === 'company_admin' || u.role === 'super_admin').length}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--monday-text-secondary)' }}>Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card style={{ borderColor: 'var(--monday-border-light)' }}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--monday-text-primary)' }}>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" style={{ color: 'var(--monday-text-secondary)' }}>
                Loading users...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--monday-border-light)' }}>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Name</th>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Email</th>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Username</th>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Role</th>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Status</th>
                      <th className="text-right p-3 text-sm font-medium" style={{ color: 'var(--monday-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors"
                        style={{ borderBottom: '1px solid var(--monday-border-light)' }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium"
                              style={{ backgroundColor: 'rgba(27, 42, 65, 0.1)', color: 'var(--monday-cornflower)' }}
                            >
                              {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
                            </div>
                            <span style={{ color: 'var(--monday-text-primary)' }}>{user.full_name}</span>
                          </div>
                        </td>
                        <td className="p-3" style={{ color: 'var(--monday-text-secondary)' }}>{user.email}</td>
                        <td className="p-3" style={{ color: 'var(--monday-text-secondary)' }}>{user.username}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPermissions(user)}
                              title="Manage Permissions"
                            >
                              <Key className="h-4 w-4" style={{ color: 'var(--monday-purple)' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              disabled={user.id === currentUser?.id}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? (
                                <UserX className="h-4 w-4" style={{ color: 'var(--monday-stuck)' }} />
                              ) : (
                                <UserCheck className="h-4 w-4" style={{ color: 'var(--monday-done)' }} />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" style={{ color: 'var(--monday-cornflower)' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" style={{ color: 'var(--monday-stuck)' }} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="john.doe@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="johndoe"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Enter password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs" style={{ color: 'var(--monday-text-muted)' }}>
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) => setCreateForm({ ...createForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send_invitation"
                  checked={createForm.send_invitation}
                  onChange={(e) => setCreateForm({ ...createForm, send_invitation: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="send_invitation" className="text-sm">
                  Send invitation email with login credentials
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={createUser.isPending}
                style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }}
              >
                {createUser.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and configure page access
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">First Name</Label>
                    <Input
                      id="edit_first_name"
                      value={editForm.first_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">Last Name</Label>
                    <Input
                      id="edit_last_name"
                      value={editForm.last_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_username">Username</Label>
                    <Input
                      id="edit_username"
                      value={editForm.username || ''}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_role">Role</Label>
                    <Select
                      value={editForm.role || ''}
                      onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                      disabled={editingUser?.id === currentUser?.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-gray-500">{role.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingUser?.id === currentUser?.id && (
                      <p className="text-xs text-orange-600">You cannot change your own role</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_password">New Password (optional)</Label>
                    <Input
                      id="edit_password"
                      type="password"
                      value={editForm.password || ''}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>
              </div>

              {/* Page Access Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Page Access</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllEditPages}
                      className="h-7 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectNoneEditPages}
                      className="h-7 text-xs"
                    >
                      None
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetToRoleDefaults}
                      className="h-7 text-xs"
                    >
                      Role Default
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PAGES.map((page) => {
                    const Icon = page.icon
                    const isEnabled = editForm.page_permissions?.pages?.includes(page.id) || false
                    const isDashboard = page.id === 'dashboard'

                    return (
                      <div
                        key={page.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          isEnabled
                            ? 'border-brand/20 bg-brand/5'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${
                            isEnabled ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium">{page.name}</span>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleEditPage(page.id)}
                          disabled={isDashboard}
                        />
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  Dashboard is always enabled. Toggle pages on/off to control what this user can see.
                </p>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUser}
                disabled={updateUser.isPending}
                style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }}
              >
                {updateUser.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Modal */}
        <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Page Access for {permissionsUser?.first_name} {permissionsUser?.last_name}
              </DialogTitle>
              <DialogDescription>
                {permissionsUser?.role === 'custom'
                  ? 'Configure which pages this user can access.'
                  : `This user has the "${getRoleLabel(permissionsUser?.role || '')}" role. To customize permissions, change their role to "Custom" first.`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4">
              {permissionsUser?.role === 'custom' && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnabledPages(ALL_PAGES.map(p => p.id))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnabledPages(['dashboard'])}
                  >
                    Select None
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {ALL_PAGES.map((page) => {
                  const Icon = page.icon
                  const isEnabled = enabledPages.includes(page.id)
                  const isDashboard = page.id === 'dashboard'
                  const isCustomRole = permissionsUser?.role === 'custom'

                  return (
                    <div
                      key={page.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isEnabled
                          ? 'border-brand/20 bg-brand/5'
                          : 'border-gray-200 bg-white'
                      } ${!isCustomRole ? 'opacity-75' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${
                          isEnabled ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <Label className="font-medium cursor-pointer">{page.name}</Label>
                          <p className="text-xs text-gray-500">{page.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => togglePage(page.id)}
                        disabled={!isCustomRole || isDashboard}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={permissionsUser?.role !== 'custom'}
                style={{ backgroundColor: 'var(--monday-cornflower)', color: 'white' }}
              >
                {permissionsUser?.role === 'custom' ? 'Save Permissions' : 'Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}
