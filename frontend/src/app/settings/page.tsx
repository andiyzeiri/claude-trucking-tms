'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, User, Building2, Bell, Shield, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useCompany } from '@/hooks/use-company'
import UserManagement from '@/components/UserManagement'

export default function SettingsPage() {
  const { user, isLoading: userLoading } = useAuth()
  const { company, isLoading: companyLoading, updateCompany, isUpdating } = useCompany()

  // Check if user is admin
  const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin'

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '',
    mc_number: '',
    dot_number: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: ''
  })

  // Update form when company data loads
  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        mc_number: company.mc_number || '',
        dot_number: company.dot_number || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        zip_code: company.zip_code || '',
        phone: company.phone || '',
        email: company.email || ''
      })
    }
  }, [company])

  const handleCompanyUpdate = () => {
    updateCompany(companyForm)
  }

  const isLoading = userLoading || companyLoading

  return (
    <Layout>
      <div className="page-settings space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and application preferences</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={user?.username || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={user?.first_name || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={user?.last_name || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={user?.role || ''} disabled className="capitalize" />
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${user?.email_verified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm text-gray-600">
                      {user?.email_verified ? 'Email Verified' : 'Email Not Verified'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="mc_number">MC Number</Label>
                    <Input
                      id="mc_number"
                      value={companyForm.mc_number}
                      onChange={(e) => setCompanyForm({ ...companyForm, mc_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dot_number">DOT Number</Label>
                    <Input
                      id="dot_number"
                      value={companyForm.dot_number}
                      onChange={(e) => setCompanyForm({ ...companyForm, dot_number: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company_email">Company Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company_phone">Company Phone</Label>
                  <Input
                    id="company_phone"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCompanyUpdate}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Company'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Company Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Company Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={companyForm.state}
                      onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={companyForm.zip_code}
                      onChange={(e) => setCompanyForm({ ...companyForm, zip_code: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCompanyUpdate}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Save Address'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notifications */}
        {!isLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Load Updates</Label>
                  <p className="text-xs text-gray-500">Get notified when loads change status</p>
                </div>
                <Button variant="outline" size="sm">On</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Driver Alerts</Label>
                  <p className="text-xs text-gray-500">Notifications for driver status changes</p>
                </div>
                <Button variant="outline" size="sm">On</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Invoice Reminders</Label>
                  <p className="text-xs text-gray-500">Reminders for overdue invoices</p>
                </div>
                <Button variant="outline" size="sm">Off</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Management - Admin Only */}
        {!isLoading && isAdmin && (
          <UserManagement />
        )}

        {/* Security Settings */}
        {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <Button>Update Password</Button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-blue-700 mt-1">Add an extra layer of security to your account</p>
                  <Button variant="outline" className="mt-3" size="sm">Enable 2FA</Button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Active Sessions</h3>
                  <p className="text-sm text-gray-600 mt-1">Manage your active sessions</p>
                  <Button variant="outline" className="mt-3" size="sm">View Sessions</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </Layout>
  )
}