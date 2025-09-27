'use client'

import React, { useState, useRef } from 'react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Upload, File, X, Eye, Download, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  const handleFileSelect = (selectedFiles: FileList) => {
    if (!selectedFiles.length) return

    setIsUploading(true)

    const newFiles: UploadedFile[] = []

    Array.from(selectedFiles).forEach((file, index) => {
      // Validate file type
      if (accept && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        alert(`File ${file.name} is not a PDF file`)
        return
      }

      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is ${maxSize}MB`)
        return
      }

      // Create file URL for preview (in production, this would be uploaded to S3)
      const fileUrl = URL.createObjectURL(file)

      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl,
        uploadedAt: new Date()
      }

      newFiles.push(uploadedFile)
    })

    // Simulate upload delay
    setTimeout(() => {
      const updatedFiles = multiple ? [...files, ...newFiles] : newFiles
      onFilesChange(updatedFiles)
      setIsUploading(false)
    }, 1000)
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
        // Revoke object URL to prevent memory leaks
        URL.revokeObjectURL(file.url)
        return false
      }
      return true
    })
    onFilesChange(updatedFiles)
  }

  const previewFile = (file: UploadedFile) => {
    window.open(file.url, '_blank')
  }

  const downloadFile = (file: UploadedFile) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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