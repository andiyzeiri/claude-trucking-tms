'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDrivers } from '@/hooks/use-drivers'
import { useDriverPayrollSettings, useCreateOrUpdateDriverPayrollSettings } from '@/hooks/use-driver-payroll-settings'
import { Loader2, Save } from 'lucide-react'

interface DriverSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DriverSettings {
  driver_id: number
  driver_name: string
  dispatch_fee_percent: number
  insurance_weekly: number
  parking_weekly: number
  trailer_weekly: number
  misc_weekly: number
}

export function DriverSettingsModal({ isOpen, onClose }: DriverSettingsModalProps) {
  const { data: drivers, isLoading: driversLoading } = useDrivers()
  const { data: allSettings, isLoading: settingsLoading } = useDriverPayrollSettings()
  const updateSettings = useCreateOrUpdateDriverPayrollSettings()

  const [driverSettings, setDriverSettings] = useState<DriverSettings[]>([])

  useEffect(() => {
    if (drivers?.items && allSettings) {
      // Create a map of existing settings
      const settingsMap = new Map(
        allSettings.map(s => [s.driver_id, s])
      )

      // Initialize settings for all drivers
      const initialSettings = drivers.items.map(driver => {
        const existing = settingsMap.get(driver.id)
        return {
          driver_id: driver.id,
          driver_name: `${driver.first_name} ${driver.last_name}`,
          dispatch_fee_percent: existing?.dispatch_fee_percent ?? 0,
          insurance_weekly: existing?.insurance_weekly ?? 0,
          parking_weekly: existing?.parking_weekly ?? 0,
          trailer_weekly: existing?.trailer_weekly ?? 0,
          misc_weekly: existing?.misc_weekly ?? 0,
        }
      })

      setDriverSettings(initialSettings)
    }
  }, [drivers, allSettings])

  const handleUpdate = (driverId: number, field: keyof DriverSettings, value: number) => {
    setDriverSettings(prev =>
      prev.map(s =>
        s.driver_id === driverId
          ? { ...s, [field]: value }
          : s
      )
    )
  }

  const handleSave = async (driverId: number) => {
    const settings = driverSettings.find(s => s.driver_id === driverId)
    if (!settings) return

    await updateSettings.mutateAsync({
      driver_id: driverId,
      dispatch_fee_percent: settings.dispatch_fee_percent,
      insurance_weekly: settings.insurance_weekly,
      parking_weekly: settings.parking_weekly,
      trailer_weekly: settings.trailer_weekly,
      misc_weekly: settings.misc_weekly,
    })
  }

  const isLoading = driversLoading || settingsLoading

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Driver Payroll Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : driverSettings.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-8 text-center">
            <p className="text-muted-foreground">No drivers found. Please add drivers first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure payroll deductions for each driver. Dispatch fee is a percentage, while insurance, parking, trailer, and misc are flat weekly rates.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Driver</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Dispatch Fee %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Insurance / Week</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Parking / Week</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Trailer / Week</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Misc / Week</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {driverSettings.map((settings) => (
                    <tr key={settings.driver_id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{settings.driver_name}</td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={settings.dispatch_fee_percent}
                          onChange={(e) => handleUpdate(settings.driver_id, 'dispatch_fee_percent', parseFloat(e.target.value) || 0)}
                          className="text-right w-20 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.insurance_weekly}
                          onChange={(e) => handleUpdate(settings.driver_id, 'insurance_weekly', parseFloat(e.target.value) || 0)}
                          className="text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.parking_weekly}
                          onChange={(e) => handleUpdate(settings.driver_id, 'parking_weekly', parseFloat(e.target.value) || 0)}
                          className="text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.trailer_weekly}
                          onChange={(e) => handleUpdate(settings.driver_id, 'trailer_weekly', parseFloat(e.target.value) || 0)}
                          className="text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.misc_weekly}
                          onChange={(e) => handleUpdate(settings.driver_id, 'misc_weekly', parseFloat(e.target.value) || 0)}
                          className="text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleSave(settings.driver_id)}
                          disabled={updateSettings.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
