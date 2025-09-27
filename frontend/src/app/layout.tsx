import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import QueryProvider from "@/providers/query-provider"
import { AuthProvider } from "@/hooks/useAuth"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Claude Trucking TMS",
  description: "Transportation Management System for Claude Trucking",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <QueryProvider>
            {children}
            <Toaster position="top-right" />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}