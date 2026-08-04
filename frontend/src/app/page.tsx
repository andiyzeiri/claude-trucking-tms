'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  Mail,
  Sparkles
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
    <div className="min-h-screen bg-surface">
      {/* ------------------------------------------------------------------ */}
      {/* Header - sticky so the CTA follows the reader down the page        */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-line-light bg-surface/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-tight text-content">
                  ABSOLUTE TMS
                </div>
                <div className="text-[11px] text-content-muted">
                  Transportation Management System
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" className="text-content-secondary hover:text-content">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-brand hover:bg-brand/90">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero - dot grid + soft brand glow behind the headline              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        {/* Decorative dot grid, fading out toward the bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(var(--brand-rgb)/0.10)_1px,transparent_0)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        {/* Soft brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Built for freight operations
            </div>

            <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-content sm:text-5xl lg:text-6xl">
              Streamline Your
              <span className="text-brand"> Transportation</span>
              <br />Business
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-content-secondary">
              The complete transportation management solution for freight companies,
              logistics providers, and fleet operators. Optimize routes, manage drivers,
              and grow your business with confidence.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-brand px-7 hover:bg-brand/90 sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-line px-7 text-content-secondary hover:bg-surface-subtle sm:w-auto"
                >
                  View Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Product preview. Built from divs rather than a screenshot so it   */}
          {/* never goes stale and ships no image weight.                       */}
          {/* ---------------------------------------------------------------- */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-line-light bg-surface shadow-[0_20px_60px_-20px_rgb(var(--brand-rgb)/0.28)]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-line-light bg-surface-subtle px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <div className="ml-3 rounded-md bg-surface px-3 py-1 text-[11px] text-content-muted">
                  absolutetms.com/dashboard
                </div>
              </div>

              <div className="flex">
                {/* Mini sidebar */}
                <div className="hidden w-40 shrink-0 border-r border-line-light p-3 sm:block">
                  <div className="mb-3 h-2 w-16 rounded bg-content-muted/25" />
                  {['Dashboard', 'Loads', 'Drivers', 'Invoices', 'Accounting'].map((label, i) => (
                    <div
                      key={label}
                      className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                        i === 0 ? 'bg-brand/10 font-medium text-brand' : 'text-content-muted'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          i === 0 ? 'bg-brand' : 'bg-content-muted/40'
                        }`}
                      />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Main panel */}
                <div className="flex-1 p-4">
                  {/* Stat tiles */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Active Loads', value: '128' },
                      { label: 'On-Time Rate', value: '96%' },
                      { label: 'Revenue MTD', value: '$412k' }
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-line-light bg-surface-subtle p-3"
                      >
                        <div className="text-[10px] uppercase tracking-wide text-content-muted">
                          {stat.label}
                        </div>
                        <div className="mt-1 text-lg font-semibold tracking-tight text-content">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="overflow-hidden rounded-lg border border-line-light">
                    <div className="flex items-center gap-3 border-b border-line-light bg-surface-subtle px-3 py-2">
                      <div className="h-1.5 w-14 rounded bg-content-muted/30" />
                      <div className="h-1.5 w-20 rounded bg-content-muted/25" />
                      <div className="ml-auto h-1.5 w-10 rounded bg-content-muted/25" />
                    </div>
                    {[
                      { w: 'w-24', status: 'bg-status-done' },
                      { w: 'w-32', status: 'bg-status-working' },
                      { w: 'w-20', status: 'bg-status-done' },
                      { w: 'w-28', status: 'bg-status-stuck' },
                      { w: 'w-24', status: 'bg-status-done' }
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 border-b border-line-light px-3 py-2.5 last:border-0"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${row.status}`} />
                        <div className={`h-1.5 ${row.w} rounded bg-content-muted/25`} />
                        <div className="h-1.5 w-16 rounded bg-content-muted/15" />
                        <div className="ml-auto h-1.5 w-12 rounded bg-content-muted/20" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="features" className="border-t border-line-light bg-surface-subtle py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h3 className="text-balance text-3xl font-semibold tracking-tight text-content sm:text-4xl">
              Everything You Need to Run Your Transportation Business
            </h3>
            <p className="mt-4 text-pretty text-lg text-content-secondary">
              From dispatch to delivery, our comprehensive platform handles every aspect of your operations.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-line-light bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_12px_32px_-12px_rgb(var(--brand-rgb)/0.25)]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 transition-colors group-hover:bg-brand/15">
                  <feature.icon className="h-5 w-5 text-brand" />
                </div>
                <h4 className="mb-2 text-base font-semibold tracking-tight text-content">
                  {feature.title}
                </h4>
                <p className="text-sm leading-relaxed text-content-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Benefits + trial card                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <h3 className="text-balance text-3xl font-semibold tracking-tight text-content sm:text-4xl">
                Why Choose Absolute TMS?
              </h3>
              <p className="mt-4 text-lg text-content-secondary">
                Join thousands of transportation companies who trust Absolute TMS to
                streamline their operations and drive growth.
              </p>
              <ul className="mt-8 space-y-3.5">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-done" />
                    <span className="text-content-secondary">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:pl-6">
              <div className="relative overflow-hidden rounded-2xl border border-line-light bg-surface p-8 shadow-[0_24px_70px_-30px_rgb(var(--brand-rgb)/0.35)]">
                {/* Brand wash in the corner */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl"
                />
                <div className="relative">
                  <h4 className="text-center text-xl font-semibold tracking-tight text-brand">
                    Start Your Free Trial
                  </h4>

                  <div className="mt-6 text-center">
                    <div className="text-5xl font-semibold tracking-tight text-content">30 Days</div>
                    <div className="mt-1 text-sm text-content-secondary">
                      No credit card required
                    </div>
                  </div>

                  <div className="mt-7 space-y-3 border-t border-line-light pt-6">
                    {[
                      { icon: Clock, text: 'Setup in under 5 minutes' },
                      { icon: Users, text: 'Unlimited users included' },
                      { icon: Shield, text: 'Enterprise-grade security' }
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10">
                          <Icon className="h-4 w-4 text-brand" />
                        </div>
                        <span className="text-sm text-content-secondary">{text}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/register" className="mt-7 block">
                    <Button size="lg" className="w-full bg-brand hover:bg-brand/90">
                      Get Started Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing CTA                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-brand py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.14)_1px,transparent_0)] [background-size:22px_22px]"
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h3 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to Transform Your Transportation Business?
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-white/80">
            Join the leading transportation companies who rely on Absolute TMS for their daily operations.
          </p>
          <Link href="/register" className="mt-8 inline-block">
            <Button size="lg" variant="secondary" className="px-8">
              Start Free Trial Today
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer - every link here resolves to a route that exists            */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-line-light bg-surface-subtle py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-content">
                  ABSOLUTE TMS
                </span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-content-secondary">
                The most trusted transportation management platform for growing businesses.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content">
                Product
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-content-secondary transition-colors hover:text-brand">
                    Features
                  </a>
                </li>
                <li>
                  <Link href="/demo" className="text-content-secondary transition-colors hover:text-brand">
                    Demo
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-content-secondary transition-colors hover:text-brand">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content">
                Support
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:support@absolutetms.com"
                    className="flex items-center gap-2 text-content-secondary transition-colors hover:text-brand"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    support@absolutetms.com
                  </a>
                </li>
                <li>
                  <Link href="/privacy" className="text-content-secondary transition-colors hover:text-brand">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-content-secondary transition-colors hover:text-brand">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-line-light pt-6 text-center text-sm text-content-muted">
            <p>&copy; {new Date().getFullYear()} Absolute TMS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
