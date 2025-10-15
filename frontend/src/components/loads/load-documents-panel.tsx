'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { FileText, Package, Eye } from 'lucide-react'
import { useUpdateLoadDocuments } from '@/hooks/use-loads'
import { Load } from '@/types'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: Date
}

interface LoadDocumentsPanelProps {
  load: Load
}

export function LoadDocumentsPanel({ load }: LoadDocumentsPanelProps) {
  const updateDocuments = useUpdateLoadDocuments()

  // Parse existing URLs into UploadedFile format
  const parseUrlToFile = (url: string | undefined, type: 'ratecon' | 'pod'): UploadedFile[] => {
    if (!url) return []

    // Handle comma-separated URLs (if multiple files were uploaded)
    const urls = url.split(',').filter(Boolean)

    return urls.map((fileUrl, index) => ({
      id: `${type}-${index}`,
      name: fileUrl.split('/').pop() || `${type}.pdf`,
      size: 0, // Size not available from URL
      type: 'application/pdf',
      url: fileUrl,
      uploadedAt: new Date()
    }))
  }

  const [rateconFiles, setRateconFiles] = useState<UploadedFile[]>(
    () => parseUrlToFile(load.ratecon_url, 'ratecon')
  )
  const [podFiles, setPodFiles] = useState<UploadedFile[]>(
    () => parseUrlToFile(load.pod_url, 'pod')
  )

  const handleRateconChange = (files: UploadedFile[]) => {
    setRateconFiles(files)
  }

  const handlePodChange = (files: UploadedFile[]) => {
    setPodFiles(files)
  }

  const handleSaveDocuments = async () => {
    // Join multiple file URLs with commas
    const ratecon_url = rateconFiles.map(f => f.url).join(',') || undefined
    const pod_url = podFiles.map(f => f.url).join(',') || undefined

    await updateDocuments.mutateAsync({
      id: load.id,
      ratecon_url,
      pod_url
    })
  }

  const hasChanges = () => {
    const currentRateconUrl = rateconFiles.map(f => f.url).join(',')
    const currentPodUrl = podFiles.map(f => f.url).join(',')

    return (
      currentRateconUrl !== (load.ratecon_url || '') ||
      currentPodUrl !== (load.pod_url || '')
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Load Documents</h2>
        {hasChanges() && (
          <Button
            onClick={handleSaveDocuments}
            disabled={updateDocuments.isPending}
          >
            {updateDocuments.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rate Confirmation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Rate Confirmation</span>
              {rateconFiles.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  {rateconFiles.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              label="Upload Rate Confirmation PDFs"
              accept=".pdf"
              multiple={true}
              maxSize={10}
              files={rateconFiles}
              onFilesChange={handleRateconChange}
            />
          </CardContent>
        </Card>

        {/* Proof of Delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-green-600" />
              <span>Proof of Delivery</span>
              {podFiles.length > 0 && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                  {podFiles.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              label="Upload POD PDFs"
              accept=".pdf"
              multiple={true}
              maxSize={10}
              files={podFiles}
              onFilesChange={handlePodChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Rate Confirmation Files</p>
              <p className="text-2xl font-bold text-blue-600">{rateconFiles.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">POD Files</p>
              <p className="text-2xl font-bold text-green-600">{podFiles.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
