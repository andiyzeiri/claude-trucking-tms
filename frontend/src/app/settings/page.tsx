'use client'

import Layout from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, User, Building2, Bell, Shield } from 'lucide-react'

export default function SettingsPage() {
  return (
    <Layout>
      <div className="page-settings space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and application preferences</p>
        </div>

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
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="Demo Admin" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="admin@example.com" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" defaultValue="(555) 123-4567" />
              </div>
              <Button className="w-full">Save Changes</Button>
            </CardContent>
          </Card>

          {/* Company Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company">Company Name</Label>
                <Input id="company" defaultValue="Claude Trucking" />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" defaultValue="123 Main St, City, State" />
              </div>
              <div>
                <Label htmlFor="tax">Tax ID</Label>
                <Input id="tax" defaultValue="12-3456789" />
              </div>
              <Button className="w-full">Update Company</Button>
            </CardContent>
          </Card>

          {/* Notifications */}
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
        </div>

        {/* Security Settings */}
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
      </div>
    </Layout>
  )
}