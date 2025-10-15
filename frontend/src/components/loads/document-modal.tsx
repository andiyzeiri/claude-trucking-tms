'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Package } from 'lucide-react'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: Date
}

interface LoadDocuments {
  ratecon: UploadedFile[]
  pod: UploadedFile[]
}

interface DocumentModalProps {
  isOpen: boolean
  onClose: () => void
  loadNumber: string
  documents: LoadDocuments
  onDocumentsChange: (documents: LoadDocuments) => void
  readOnly?: boolean
}

export function DocumentModal({
  isOpen,
  onClose,
  loadNumber,
  documents,
  onDocumentsChange,
  readOnly = false
}: DocumentModalProps) {
  const [localDocuments, setLocalDocuments] = useState<LoadDocuments>(documents)

  const handleRateconChange = (files: UploadedFile[]) => {
    const updated = { ...localDocuments, ratecon: files }
    setLocalDocuments(updated)
  }

  const handlePodChange = (files: UploadedFile[]) => {
    const updated = { ...localDocuments, pod: files }
    setLocalDocuments(updated)
  }

  const handleSave = () => {
    // Extract URLs from uploaded files
    // If multiple files, join them with comma (for now - could be enhanced to support multiple URLs)
    const updatedDocuments = {
      ratecon: localDocuments.ratecon,
      pod: localDocuments.pod
    }
    onDocumentsChange(updatedDocuments)
    onClose()
  }

  const handleCancel = () => {
    setLocalDocuments(documents) // Reset to original
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Documents - Load {loadNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Tabs defaultValue="ratecon" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ratecon" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Rate Confirmation</span>
                {localDocuments.ratecon.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                    {localDocuments.ratecon.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="pod" className="flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Proof of Delivery</span>
                {localDocuments.pod.length > 0 && (
                  <span className="ml-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                    {localDocuments.pod.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ratecon" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rate Confirmation Documents</CardTitle>
                  <p className="text-sm text-gray-600">
                    Upload signed rate confirmation documents for this load.
                  </p>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    label="Upload Rate Confirmation PDFs"
                    accept=".pdf"
                    multiple={true}
                    maxSize={10}
                    files={localDocuments.ratecon}
                    onFilesChange={handleRateconChange}
                    disabled={readOnly}
                  />
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Files</p>
                        <p className="text-2xl font-bold text-blue-600">{localDocuments.ratecon.length}</p>
                      </div>
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Size</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {(localDocuments.ratecon.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pod" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Proof of Delivery Documents</CardTitle>
                  <p className="text-sm text-gray-600">
                    Upload signed proof of delivery documents showing successful completion of this load.
                  </p>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    label="Upload POD PDFs"
                    accept=".pdf"
                    multiple={true}
                    maxSize={10}
                    files={localDocuments.pod}
                    onFilesChange={handlePodChange}
                    disabled={readOnly}
                  />
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Files</p>
                        <p className="text-2xl font-bold text-green-600">{localDocuments.pod.length}</p>
                      </div>
                      <FileText className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Size</p>
                        <p className="text-2xl font-bold text-green-600">
                          {(localDocuments.pod.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {!readOnly && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}