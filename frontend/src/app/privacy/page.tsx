import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowLeft, Shield, Eye, Database, Lock } from 'lucide-react'

export default function PrivacyPage() {
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
                <p className="text-xs text-gray-500">Privacy Policy</p>
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
              <CardTitle className="text-3xl flex items-center">
                <Shield className="h-8 w-8 text-blue-600 mr-3" />
                Privacy Policy
              </CardTitle>
              <p className="text-gray-600">Last updated: December 2024</p>
            </CardHeader>
            <CardContent className="prose prose-gray max-w-none">
              <div className="grid md:grid-cols-3 gap-6 mb-8 not-prose">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <Eye className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900">Transparency</h3>
                  <p className="text-sm text-gray-600">Clear information about data collection and use</p>
                </div>
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <Lock className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900">Security</h3>
                  <p className="text-sm text-gray-600">Enterprise-grade encryption and protection</p>
                </div>
                <div className="text-center p-6 bg-purple-50 rounded-lg">
                  <Database className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900">Control</h3>
                  <p className="text-sm text-gray-600">You control your data and privacy settings</p>
                </div>
              </div>

              <h2>1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
              </p>
              <ul>
                <li>Account information (name, email, company details)</li>
                <li>Fleet and operational data you input into the system</li>
                <li>Usage data and system interactions</li>
                <li>Communication records with our support team</li>
              </ul>

              <h2>2. How We Use Your Information</h2>
              <p>
                We use the information we collect to provide, maintain, and improve our services:
              </p>
              <ul>
                <li>Operate and maintain the TMS platform</li>
                <li>Process transactions and send related information</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Send technical notices and security alerts</li>
                <li>Improve our services and develop new features</li>
              </ul>

              <h2>3. Information Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to third parties except in the following circumstances:
              </p>
              <ul>
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With service providers who assist in operating our platform</li>
              </ul>

              <h2>4. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul>
                <li>End-to-end encryption for data transmission</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and employee training</li>
                <li>Secure data centers with 24/7 monitoring</li>
              </ul>

              <h2>5. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to provide our services and comply with legal obligations. You may request deletion of your data at any time.
              </p>

              <h2>6. Your Rights</h2>
              <p>
                Depending on your location, you may have certain rights regarding your personal information:
              </p>
              <ul>
                <li>Access and portability of your data</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your personal data</li>
                <li>Restriction of processing</li>
                <li>Objection to certain processing activities</li>
              </ul>

              <h2>7. Cookies and Tracking</h2>
              <p>
                We use cookies and similar technologies to enhance your experience and analyze usage patterns. You can control cookie preferences through your browser settings.
              </p>

              <h2>8. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.
              </p>

              <h2>9. Children's Privacy</h2>
              <p>
                Our services are not intended for use by children under 16. We do not knowingly collect personal information from children under 16.
              </p>

              <h2>10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of any material changes by email or through our service.
              </p>

              <h2>11. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, please contact our Data Protection Officer at privacy@absolutetms.com.
              </p>

              <div className="bg-blue-50 p-6 rounded-lg mt-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Your Data, Your Control</h3>
                <p className="text-sm text-blue-800 mb-4">
                  We believe you should have full control over your data. Access your privacy dashboard to manage your preferences, download your data, or request deletion at any time.
                </p>
                <Link href="/dashboard/privacy">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Manage Privacy Settings
                  </Button>
                </Link>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mt-8">
                <p className="text-sm text-gray-600 font-medium">
                  Note: This is a demo application. This privacy policy is for demonstration purposes only and does not constitute actual data processing practices.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}