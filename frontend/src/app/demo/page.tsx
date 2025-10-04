'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Truck,
  ArrowLeft,
  MapPin,
  Users,
  DollarSign,
  BarChart3,
  Clock,
  Package,
  Shield,
  CheckCircle,
  Play,
  ArrowRight,
  Calendar,
  Route
} from 'lucide-react'

export default function DemoPage() {
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null)

  const demoFeatures = [
    {
      id: 'dashboard',
      title: 'Analytics Dashboard',
      icon: BarChart3,
      description: 'Real-time insights into your fleet performance, revenue, and operational metrics.',
      preview: 'View live KPIs, charts, and performance indicators',
      color: 'bg-blue-500'
    },
    {
      id: 'fleet',
      title: 'Fleet Management',
      icon: Truck,
      description: 'Track vehicles, manage maintenance schedules, and monitor driver assignments.',
      preview: 'See GPS tracking, vehicle status, and maintenance alerts',
      color: 'bg-green-500'
    },
    {
      id: 'loads',
      title: 'Load Management',
      icon: Package,
      description: 'Dispatch loads, optimize routes, and track deliveries from pickup to delivery.',
      preview: 'Manage load assignments and track progress',
      color: 'bg-purple-500'
    },
    {
      id: 'drivers',
      title: 'Driver Management',
      icon: Users,
      description: 'Manage driver profiles, schedules, performance metrics, and compliance.',
      preview: 'View driver performance, schedules, and documents',
      color: 'bg-orange-500'
    },
    {
      id: 'routes',
      title: 'Route Optimization',
      icon: Route,
      description: 'AI-powered route planning to reduce fuel costs and improve delivery times.',
      preview: 'See optimized routes and fuel savings',
      color: 'bg-indigo-500'
    },
    {
      id: 'financials',
      title: 'Financial Management',
      icon: DollarSign,
      description: 'Comprehensive invoicing, expense tracking, and profitability analysis.',
      preview: 'Review revenue reports and expense breakdowns',
      color: 'bg-emerald-500'
    }
  ]

  const stats = [
    { label: 'Active Fleets', value: '2,500+', icon: Truck },
    { label: 'Daily Loads', value: '15,000+', icon: Package },
    { label: 'Cost Savings', value: '25%', icon: DollarSign },
    { label: 'Uptime', value: '99.9%', icon: Shield }
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      company: 'Swift Logistics',
      role: 'Operations Manager',
      quote: 'Absolute TMS reduced our operational costs by 30% and improved our on-time delivery rate to 98%.'
    },
    {
      name: 'Mike Rodriguez',
      company: 'Freight Masters',
      role: 'Fleet Manager',
      quote: 'The route optimization feature alone has saved us thousands in fuel costs every month.'
    },
    {
      name: 'Jennifer Chen',
      company: 'Trans Global',
      role: 'CEO',
      quote: 'Best investment we\'ve made. The system pays for itself within the first quarter.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">ABSOLUTE TMS</h1>
                <p className="text-xs text-gray-500">Demo Experience</p>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/register">
                <Button>Start Free Trial</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Interactive Demo
            </Badge>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Experience Absolute TMS in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Explore our comprehensive transportation management platform through interactive demos
              and see how it can transform your business operations.
            </p>
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 py-4">
                <Play className="mr-2 h-5 w-5" />
                Try Live Demo Now
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <stat.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Features */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Explore Key Features
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Click on any feature below to see it in action and understand how it can benefit your business.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {demoFeatures.map((feature) => (
              <Card
                key={feature.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-xl border-0 ${
                  selectedDemo === feature.id ? 'ring-2 ring-blue-500 shadow-xl' : 'shadow-lg'
                }`}
                onClick={() => setSelectedDemo(feature.id)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">{feature.description}</p>
                  <div className="flex items-center text-xs text-blue-600 font-medium">
                    <Play className="h-3 w-3 mr-1" />
                    {feature.preview}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedDemo && (
            <div className="mt-12 bg-white rounded-lg shadow-xl p-8">
              <div className="text-center mb-8">
                <h4 className="text-2xl font-bold text-gray-900 mb-4">
                  {demoFeatures.find(f => f.id === selectedDemo)?.title} Demo
                </h4>
                <p className="text-gray-600 mb-6">
                  This would show an interactive demo of the {selectedDemo} feature.
                  In the full version, you'd see screenshots, videos, or live interactions.
                </p>
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg p-12 mb-6">
                  <div className="flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="h-16 w-16 mx-auto mb-4 text-blue-600" />
                      <p className="text-lg font-medium">Interactive Demo Placeholder</p>
                      <p className="text-sm">Experience the full feature in the live demo</p>
                    </div>
                  </div>
                </div>
                <Link href="/login">
                  <Button size="lg">
                    Try This Feature Live
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              What Our Customers Say
            </h3>
            <p className="text-lg text-gray-600">
              Join thousands of satisfied transportation companies
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <CheckCircle key={i} className="h-4 w-4 text-yellow-500" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">"{testimonial.quote}"</p>
                  <div className="border-t pt-4">
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                    <div className="text-sm font-medium text-blue-600">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-white mb-6">
              Ready to See the Full System?
            </h3>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Experience all features with real data in our interactive demo environment.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-4">
                  <Play className="mr-2 h-5 w-5" />
                  Launch Live Demo
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="text-lg px-8 py-4 text-white border-white hover:bg-white hover:text-blue-600">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Truck className="h-6 w-6 text-blue-400" />
              <span className="font-bold text-lg">ABSOLUTE TMS</span>
            </div>
            <p className="text-gray-400 text-sm">
              &copy; 2024 Absolute TMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}