'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Truck, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { z } from 'zod'
import toast from 'react-hot-toast'

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const email = watch('email')

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      setIsSubmitted(true)
      toast.success('Password reset instructions sent!')
    } catch (error) {
      toast.error('Failed to send reset instructions. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Check Your Email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent password reset instructions to
            </p>
            <p className="font-medium text-gray-900">{email}</p>
          </div>

          <Card className="shadow-xl border-0">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Next Steps:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Check your email inbox and spam folder</li>
                    <li>• Click the reset link in the email</li>
                    <li>• Create a new secure password</li>
                    <li>• Sign in with your new password</li>
                  </ul>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Didn't receive the email? It may take a few minutes to arrive.
                </p>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsSubmitted(false)}
                    className="flex-1"
                  >
                    Try Different Email
                  </Button>
                  <Button
                    onClick={() => onSubmit({ email })}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Resending...' : 'Resend Email'}
                  </Button>
                </div>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500">
                    ← Back to Sign In
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Link>

          <div className="flex justify-center mb-6">
            <Truck className="h-12 w-12 text-blue-600" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you instructions to reset your password.
          </p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>
              We'll email you a secure link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    className="pl-10"
                    placeholder="Enter your email address"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full text-lg py-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending Instructions...
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Remember your password?{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This is a demo application. Password reset emails are not actually sent.
            You can use any email and password to access the system.
          </p>
        </div>
      </div>
    </div>
  )
}