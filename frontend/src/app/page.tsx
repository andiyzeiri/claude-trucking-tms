'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Truck,
  MapPin,
  Users,
  DollarSign,
  BarChart3,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  Building
} from 'lucide-react'

export default function LandingPage() {
  const features = [
    {
      icon: Truck,
      title: 'Fleet Management',
      description: 'Track and manage your entire fleet with real-time GPS monitoring and maintenance schedules.'
    },
    {
      icon: MapPin,
      title: 'Route Optimization',
      description: 'AI-powered route planning to reduce fuel costs and improve delivery times.'
    },
    {
      icon: Users,
      title: 'Driver Management',
      description: 'Manage driver schedules, performance metrics, and compliance documentation.'
    },
    {
      icon: DollarSign,
      title: 'Financial Tracking',
      description: 'Comprehensive invoicing, expense tracking, and profitability analysis.'
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Real-time insights and reporting to make data-driven decisions.'
    },
    {
      icon: Shield,
      title: 'Compliance Management',
      description: 'Stay compliant with DOT regulations and safety requirements.'
    }
  ]

  const benefits = [
    'Reduce operational costs by up to 25%',
    'Improve on-time delivery rates',
    'Streamline dispatch operations',
    'Enhance customer satisfaction',
    'Automate billing and invoicing',
    'Ensure regulatory compliance'
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">ABSOLUTE TMS</h1>
                <p className="text-xs text-gray-500">Transportation Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Streamline Your
              <span className="text-blue-600"> Transportation</span>
              <br />Business
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The complete transportation management solution for freight companies,
              logistics providers, and fleet operators. Optimize routes, manage drivers,
              and grow your business with confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/register">
                <Button size="lg" className="text-lg px-8 py-4">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Transportation Business
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From dispatch to delivery, our comprehensive platform handles every aspect of your operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-center">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">
                Why Choose Absolute TMS?
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                Join thousands of transportation companies who trust Absolute TMS to
                streamline their operations and drive growth.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:pl-8">
              <Card className="border-0 shadow-2xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-blue-600">
                    Start Your Free Trial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900">30 Days</div>
                    <div className="text-gray-600">No credit card required</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span>Setup in under 5 minutes</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span>Unlimited users included</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span>Enterprise-grade security</span>
                    </div>
                  </div>
                  <Link href="/register" className="block">
                    <Button size="lg" className="w-full text-lg">
                      Get Started Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-white mb-6">
              Ready to Transform Your Transportation Business?
            </h3>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join the leading transportation companies who rely on Absolute TMS for their daily operations.
            </p>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-4">
                Start Free Trial Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Truck className="h-6 w-6 text-blue-400" />
                <span className="font-bold text-lg">ABSOLUTE TMS</span>
              </div>
              <p className="text-gray-400 text-sm">
                The most trusted transportation management platform for growing businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div>Features</div>
                <div>Pricing</div>
                <div>Demo</div>
                <div>API</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div>About</div>
                <div>Blog</div>
                <div>Careers</div>
                <div>Press</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>support@absolutetms.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>(555) 123-4567</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Absolute TMS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}