import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import QueryProvider from "@/providers/query-provider"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Absolute TMS — Transportation Management System",
  description:
    "Dispatch, fleet, driver, and financial management for freight operations in one platform.",
  icons: {
    icon: '/favicon.svg',
  },
}

// Next 14+ wants viewport in its own export; leaving it inside `metadata`
// is deprecated and was emitting build warnings on every page.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Figtree was requested here but never rendered: next/font puts an
            Inter class on <body>, and a class selector beats the
            `body { font-family: var(--font-family-body) }` element rule in
            globals.css. So every page paid for a render-blocking font it
            never used. Poppins stays - the h1-h6 rule targets those elements
            directly, so headings really do use it. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <Toaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  )
}