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
        {/* No web-font <link> at all now. Body and headings both use Inter,
            which next/font self-hosts and preloads - so there is no
            render-blocking request to fonts.googleapis.com on any page.
            Figtree was removed earlier (it never rendered); Poppins went
            with the move to a single family. */}
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