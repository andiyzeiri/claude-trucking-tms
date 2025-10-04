import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">ABSOLUTE TMS</h1>
                <p className="text-xs text-gray-500">Terms of Service</p>
              </div>
            </Link>
            <Link href="/register">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Registration
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Terms of Service</CardTitle>
              <p className="text-gray-600">Last updated: December 2024</p>
            </CardHeader>
            <CardContent className="prose prose-gray max-w-none">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing and using Absolute TMS ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
              </p>

              <h2>2. Description of Service</h2>
              <p>
                Absolute TMS is a comprehensive transportation management system that provides fleet management, load dispatch, driver management, and financial tracking services.
              </p>

              <h2>3. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>

              <h2>4. Data Privacy</h2>
              <p>
                We are committed to protecting your privacy. Please review our Privacy Policy to understand how we collect, use, and protect your information.
              </p>

              <h2>5. Acceptable Use</h2>
              <p>
                You agree to use the Service only for lawful purposes and in a way that does not infringe the rights of others or restrict their use and enjoyment of the Service.
              </p>

              <h2>6. Subscription and Payment</h2>
              <p>
                Access to premium features requires a paid subscription. Fees are billed in advance and are non-refundable except as required by law.
              </p>

              <h2>7. Termination</h2>
              <p>
                We may terminate or suspend your access to the Service immediately, without prior notice, for conduct that we believe violates these Terms.
              </p>

              <h2>8. Limitation of Liability</h2>
              <p>
                The Service is provided "as is" without warranty of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages.
              </p>

              <h2>9. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the Service constitutes acceptance of modified terms.
              </p>

              <h2>10. Contact Information</h2>
              <p>
                For questions about these Terms of Service, please contact us at legal@absolutetms.com.
              </p>

              <div className="bg-gray-50 p-6 rounded-lg mt-8">
                <p className="text-sm text-gray-600 font-medium">
                  Note: This is a demo application. These terms are for demonstration purposes only and do not constitute a legal agreement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}