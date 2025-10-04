'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Edit2, Trash2, Plus, X, Check, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_active: boolean
  email_verified: boolean
  role: string
  company_id: number
  page_permissions?: { pages: string[] }
  allowed_pages?: string[]
}

const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'loads', label: 'Loads' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'trucks', label: 'Trucks' },
  { id: 'customers', label: 'Customers' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'reports', label: 'Reports' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'lanes', label: 'Lanes' },
  { id: 'settings', label: 'Settings' }
]

const ROLES = [
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
  { value: 'customer', label: 'Customer' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'custom', label: 'Custom' }
]

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: '',
    is_active: true,
    selectedPages: [] as string[]
  })

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['company-users'],
    queryFn: async (): Promise<User[]> => {
      const response = await api.get('/v1/users/company-users')
      return response.data
    }
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: number; userData: any }) => {
      const response = await api.put(`/v1/users/${data.userId}`, data.userData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] })
      toast.success('User updated successfully!')
      setShowEditDialog(false)
      setEditingUser(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update user'
      toast.error(message)
    }
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.delete(`/v1/users/${userId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] })
      toast.success('User deleted successfully!')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete user'
      toast.error(message)
    }
  })

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      password: '',
      role: user.role,
      is_active: user.is_active,
      selectedPages: user.role === 'custom'
        ? (user.page_permissions?.pages || [])
        : (user.allowed_pages || [])
    })
    setShowEditDialog(true)
  }

  const handleUpdateUser = () => {
    if (!editingUser) return

    const userData: any = {
      username: editForm.username,
      email: editForm.email,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      role: editForm.role,
      is_active: editForm.is_active
    }

    // Only include password if changed
    if (editForm.password) {
      userData.password = editForm.password
    }

    // Include page permissions for custom role
    if (editForm.role === 'custom') {
      userData.page_permissions = { pages: editForm.selectedPages }
    }

    updateUserMutation.mutate({ userId: editingUser.id, userData })
  }

  const handleDeleteUser = (userId: number) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUserMutation.mutate(userId)
    }
  }

  const togglePage = (pageId: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedPages: prev.selectedPages.includes(pageId)
        ? prev.selectedPages.filter(p => p !== pageId)
        : [...prev.selectedPages, pageId]
    }))
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              User Management
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{user.full_name}</h3>
                      <p className="text-sm text-gray-600">@{user.username}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span>{user.email}</span>
                    <span className="capitalize">{user.role.replace('_', ' ')}</span>
                    {user.allowed_pages && (
                      <span>{user.allowed_pages.length} pages</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditUser(user)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {showEditDialog && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Edit User: {editingUser.full_name}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingUser(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_username">Username</Label>
                    <Input
                      id="edit_username"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_first_name">First Name</Label>
                    <Input
                      id="edit_first_name"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_last_name">Last Name</Label>
                    <Input
                      id="edit_last_name"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit_password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="edit_password"
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <Label htmlFor="edit_role">Role</Label>
                  <select
                    id="edit_role"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit_is_active">Account Active</Label>
                </div>

                {/* Page Permissions (show for custom role) */}
                {editForm.role === 'custom' && (
                  <div>
                    <Label className="mb-3 block">Page Access Permissions</Label>
                    <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                      {ALL_PAGES.map(page => (
                        <div key={page.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`page_${page.id}`}
                            checked={editForm.selectedPages.includes(page.id)}
                            onChange={() => togglePage(page.id)}
                            className="w-4 h-4"
                          />
                          <label htmlFor={`page_${page.id}`} className="text-sm cursor-pointer">
                            {page.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Select which pages this user can access. Dashboard is recommended for all users.
                    </p>
                  </div>
                )}

                {/* Show current permissions for non-custom roles */}
                {editForm.role !== 'custom' && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      Default Pages for {ROLES.find(r => r.value === editForm.role)?.label}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {editForm.selectedPages.map(page => (
                        <span key={page} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {ALL_PAGES.find(p => p.id === page)?.label || page}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleUpdateUser}
                    disabled={updateUserMutation.isPending}
                    className="flex-1"
                  >
                    {updateUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false)
                      setEditingUser(null)
                    }}
                    disabled={updateUserMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
