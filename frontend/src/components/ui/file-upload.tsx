'use client'

import React, { useState, useRef } from 'react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Upload, File, X, Eye, Download, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: Date
}

interface FileUploadProps {
  label: string
  accept?: string
  multiple?: boolean
  maxSize?: number // in MB
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  className?: string
  disabled?: boolean
}

export function FileUpload({
  label,
  accept = '.pdf',
  multiple = false,
  maxSize = 10, // 10MB default
  files,
  onFilesChange,
  className,
  disabled = false
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFiles: FileList) => {
    if (!selectedFiles.length) return

    setIsUploading(true)

    const newFiles: UploadedFile[] = []
    const uploadPromises: Promise<void>[] = []

    Array.from(selectedFiles).forEach((file, index) => {
      // Validate file type
      if (accept && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`File ${file.name} is not a PDF file`)
        return
      }

      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is ${maxSize}MB`)
        return
      }

      // Upload file to backend
      const uploadPromise = (async () => {
        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await api.post('/v1/uploads/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })

          const uploadedFile: UploadedFile = {
            id: `${Date.now()}-${index}`,
            name: response.data.filename,
            size: response.data.size,
            type: file.type,
            url: response.data.url, // Backend URL (S3 or local storage path)
            uploadedAt: new Date()
          }

          newFiles.push(uploadedFile)
        } catch (error: any) {
          console.error('Upload error:', error)
          toast.error(`Failed to upload ${file.name}: ${error.response?.data?.detail || error.message}`)
        }
      })()

      uploadPromises.push(uploadPromise)
    })

    // Wait for all uploads to complete
    await Promise.all(uploadPromises)

    // Update state with uploaded files
    if (newFiles.length > 0) {
      const updatedFiles = multiple ? [...files, ...newFiles] : newFiles
      onFilesChange(updatedFiles)
      toast.success(`Successfully uploaded ${newFiles.length} file(s)`)
    }

    setIsUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (disabled || isUploading) return

    const droppedFiles = e.dataTransfer.files
    handleFileSelect(droppedFiles)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles) {
      handleFileSelect(selectedFiles)
    }
  }

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(file => {
      if (file.id === fileId) {
        // Only revoke if it's a blob URL (starts with 'blob:')
        if (file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url)
        }
        return false
      }
      return true
    })
    onFilesChange(updatedFiles)
  }

  const getProxiedUrl = (url: string): string => {
    // If it's a direct S3 URL, convert it to use the backend proxy
    if (url.includes('s3.amazonaws.com') || url.includes('.s3.')) {
      // Extract filename from S3 URL
      const filename = url.split('/').pop() || ''
      return `${process.env.NEXT_PUBLIC_API_URL || ''}/v1/uploads/s3/${filename}`
    }
    // If it's already a backend URL, use it as-is
    if (url.startsWith('/api') || url.startsWith('/v1')) {
      return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`
    }
    // Otherwise return as-is
    return url
  }

  const previewFile = (file: UploadedFile) => {
    const proxiedUrl = getProxiedUrl(file.url)
    window.open(proxiedUrl, '_blank')
  }

  const downloadFile = async (file: UploadedFile) => {
    try {
      const proxiedUrl = getProxiedUrl(file.url)

      // Fetch through backend with auth
      const response = await api.get(proxiedUrl, {
        responseType: 'blob'
      })

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download file')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn('space-y-4', className)}>
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        <div className="space-y-2">
          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
          {isUploading ? (
            <div>
              <p className="text-sm text-gray-600">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Drop PDF files here or <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Maximum file size: {maxSize}MB
              </p>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Files ({files.length})</h4>
          {files.map((file) => (
            <Card key={file.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.uploadedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => previewFile(file)}
                    className="h-8 w-8 p-0"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(file)}
                    className="h-8 w-8 p-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Remove"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}