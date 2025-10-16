'use client'

import { useState, useEffect } from 'react'

interface PdfViewerProps {
  url: string
  title: string
}

export function PdfViewer({ url, title }: PdfViewerProps) {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPresignedUrl = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('PdfViewer: Processing URL:', url)

        // Get token from cookie
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`
          const parts = value.split(`; ${name}=`)
          if (parts.length === 2) return parts.pop()?.split(';').shift()
        }
        const token = getCookie('auth-token')

        let apiUrl = url

        // Convert direct S3 URLs to backend proxy URLs
        if (url.includes('s3.amazonaws.com') || url.includes('.s3.')) {
          // Extract filename from S3 URL
          const filename = url.split('/').pop() || ''
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
          apiUrl = `${baseUrl}/v1/uploads/s3/${filename}`
          console.log('PdfViewer: Converted S3 URL to proxy:', apiUrl)
        } else if (url.startsWith('/v1/uploads/')) {
          // Relative backend URL - add base URL
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
          apiUrl = `${baseUrl}${url}`
          console.log('PdfViewer: Added base URL:', apiUrl)
        }

        // Fetch the presigned URL from the API
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        console.log('PdfViewer: Response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('PdfViewer: Error response:', errorText)
          throw new Error(`Failed to load PDF: ${response.status}`)
        }

        // Check if response is JSON (presigned URL) or direct PDF
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          // Get the presigned URL from the JSON response
          const data = await response.json()
          console.log('PdfViewer: Got presigned URL')
          setPresignedUrl(data.url)
        } else if (contentType?.includes('application/pdf')) {
          // Direct PDF response - use as blob URL
          const blob = await response.blob()
          const blobUrl = URL.createObjectURL(blob)
          console.log('PdfViewer: Got direct PDF, created blob URL')
          setPresignedUrl(blobUrl)
        } else {
          throw new Error('Unexpected response type: ' + contentType)
        }
      } catch (err) {
        console.error('PdfViewer: Error fetching PDF:', err)
        setError(err instanceof Error ? err.message : 'Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }

    fetchPresignedUrl()
  }, [url])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="font-semibold mb-2">Error loading PDF</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={presignedUrl || url}
      className="w-full h-full border-0"
      title={title}
    />
  )
}
