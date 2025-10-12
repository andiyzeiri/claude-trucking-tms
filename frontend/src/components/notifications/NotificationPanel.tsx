'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MessageSquare, Send } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface NotificationPanelProps {
  driverId?: number
  driverName?: string
  loadId?: number
  loadNumber?: string
}

export default function NotificationPanel({
  driverId,
  driverName,
  loadId,
  loadNumber
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notificationType, setNotificationType] = useState<'custom' | 'assignment' | 'update'>('custom')
  const [updateMessage, setUpdateMessage] = useState('')

  const handleSendCustomMessage = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (!driverId) {
      toast.error('No driver selected')
      return
    }

    setSending(true)
    try {
      await api.post(`/v1/notifications/drivers/${driverId}/notify`, null, {
        params: { message: message }
      })
      toast.success('Notification sent successfully!')
      setMessage('')
      setOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const handleSendLoadAssignment = async () => {
    if (!driverId || !loadId) {
      toast.error('Driver and load must be selected')
      return
    }

    setSending(true)
    try {
      await api.post('/v1/notifications/loads/assignment', {
        driver_id: driverId,
        load_id: loadId
      })
      toast.success('Load assignment notification sent!')
      setOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const handleSendLoadUpdate = async () => {
    if (!updateMessage.trim()) {
      toast.error('Please enter an update message')
      return
    }

    if (!driverId || !loadId) {
      toast.error('Driver and load must be selected')
      return
    }

    setSending(true)
    try {
      await api.post('/v1/notifications/loads/update', {
        driver_id: driverId,
        load_id: loadId,
        update_message: updateMessage
      })
      toast.success('Load update notification sent!')
      setUpdateMessage('')
      setOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          title="Send SMS notification"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {driverName && (
            <div className="text-sm">
              <span className="font-medium">Driver:</span> {driverName}
            </div>
          )}

          {loadNumber && (
            <div className="text-sm">
              <span className="font-medium">Load:</span> {loadNumber}
            </div>
          )}

          {/* Notification Type Selector */}
          <div className="flex gap-2 border-b pb-2">
            <button
              onClick={() => setNotificationType('custom')}
              className={`px-3 py-1 text-sm rounded ${
                notificationType === 'custom'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Custom Message
            </button>
            {loadId && (
              <>
                <button
                  onClick={() => setNotificationType('assignment')}
                  className={`px-3 py-1 text-sm rounded ${
                    notificationType === 'assignment'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Load Assignment
                </button>
                <button
                  onClick={() => setNotificationType('update')}
                  className={`px-3 py-1 text-sm rounded ${
                    notificationType === 'update'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Load Update
                </button>
              </>
            )}
          </div>

          {/* Custom Message */}
          {notificationType === 'custom' && (
            <>
              <Textarea
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={1600}
              />
              <div className="text-xs text-gray-500 text-right">
                {message.length}/1600 characters
              </div>
              <Button
                onClick={handleSendCustomMessage}
                disabled={sending || !message.trim()}
                className="w-full"
              >
                {sending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </>
          )}

          {/* Load Assignment */}
          {notificationType === 'assignment' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                <p className="font-medium mb-2">This will send a formatted message with:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Load number</li>
                  <li>Pickup location</li>
                  <li>Delivery location</li>
                  <li>Pickup date</li>
                </ul>
              </div>
              <Button
                onClick={handleSendLoadAssignment}
                disabled={sending}
                className="w-full"
              >
                {sending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Load Assignment
                  </>
                )}
              </Button>
            </>
          )}

          {/* Load Update */}
          {notificationType === 'update' && (
            <>
              <Textarea
                placeholder="Enter update details (e.g., 'Pickup time changed to 2:00 PM')"
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                rows={4}
                maxLength={1600}
              />
              <Button
                onClick={handleSendLoadUpdate}
                disabled={sending || !updateMessage.trim()}
                className="w-full"
              >
                {sending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Update
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
