'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Receivers now live on the Lanes page.
export default function ReceiversRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/lanes?tab=receivers') }, [router])
  return null
}
