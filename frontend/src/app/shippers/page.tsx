'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Shippers now live on the Lanes page.
export default function ShippersRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/lanes?tab=shippers') }, [router])
  return null
}
