'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/use-auth'
import { loginSchema, LoginFormData } from '@/lib/schemas'
import {
  Truck,
  ArrowLeft,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
  Mail,
  Lock
} from 'lucide-react'

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormData) => {
    login(data)
  }

  const features = [
    'Real-time fleet tracking and management',
    'Automated dispatch and route optimization',
    'Comprehensive financial reporting',
    'DOT compliance and safety management',
    'Driver performance analytics'
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-subtle to-brand/5 flex">
      {/* Left Side - Features & Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand text-white flex-col justify-center px-12">
        <div className="max-w-md">
          <div className="flex items-center space-x-3 mb-8">
            <Truck className="h-10 w-10" />
            <div>
              <h1 className="text-2xl font-bold">ABSOLUTE TMS</h1>
              <p className="text-white/70">Transportation Management System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-6">
            Welcome Back to Your TMS Dashboard
          </h2>

          <p className="text-white/80 mb-8 leading-relaxed">
            Manage your fleet, optimize routes, and grow your transportation business with the most trusted TMS platform.
          </p>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-white/80 text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-brand rounded-lg">
            <h3 className="font-semibold mb-2">New to Absolute TMS?</h3>
            <p className="text-white/70 text-sm mb-4">
              Start your free 30-day trial today and experience the difference.
            </p>
            <Link href="/register">
              <Button variant="secondary" size="sm">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>

            <div className="flex justify-center lg:hidden mb-6">
              <Truck className="h-10 w-10 text-brand" />
            </div>

            <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
            <p className="mt-2 text-sm text-gray-600">
              Access your Transportation Management System
            </p>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader className="text-center">
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>
                Enter your credentials to access your TMS dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-500" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      className="pl-10"
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      className="pl-10 pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked: boolean) => setRememberMe(checked)}
                    />
                    <Label htmlFor="remember" className="text-sm cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Link href="/forgot-password" className="text-sm text-brand hover:text-brand">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full text-lg py-6"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-brand hover:text-brand font-medium">
                Start your free trial
              </Link>
            </p>

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Protected by enterprise-grade security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}