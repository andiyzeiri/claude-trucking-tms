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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck, ArrowLeft, Shield, CheckCircle } from 'lucide-react'
import { z } from 'zod'
import toast from 'react-hot-toast'

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  companyName: z.string().min(1, 'Company name is required'),
  companySize: z.string().min(1, 'Company size is required'),
  phoneNumber: z.string().min(10, 'Phone number is required'),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to terms'),
  agreeToMarketing: z.boolean().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const watchedFields = watch()

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      toast.success('Account created successfully! Please check your email to verify your account.')

      // In a real app, you'd redirect to verification page or dashboard
      console.log('Registration data:', data)
    } catch (error) {
      toast.error('Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = async () => {
    const fieldsToValidate = step === 1
      ? ['firstName', 'lastName', 'email', 'password', 'confirmPassword']
      : ['companyName', 'companySize', 'phoneNumber']

    const isValid = await trigger(fieldsToValidate as any)
    if (isValid) {
      setStep(2)
    }
  }

  const benefits = [
    'Free 30-day trial with full features',
    'No setup fees or hidden costs',
    'Dedicated customer success manager',
    'Migration assistance from your current system',
    'Enterprise-grade security and compliance'
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Left Side - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 text-white flex-col justify-center px-12">
        <div className="max-w-md">
          <div className="flex items-center space-x-3 mb-8">
            <Truck className="h-10 w-10" />
            <div>
              <h1 className="text-2xl font-bold">ABSOLUTE TMS</h1>
              <p className="text-blue-200">Transportation Management System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-6">
            Join 10,000+ Transportation Companies
          </h2>

          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-blue-100">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-blue-700 rounded-lg">
            <h3 className="font-semibold mb-2">Need Help Getting Started?</h3>
            <p className="text-blue-200 text-sm mb-4">
              Our team is ready to help you migrate from your current system and get up and running quickly.
            </p>
            <Button variant="secondary" size="sm">
              Schedule Demo Call
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>

            <div className="flex justify-center lg:hidden mb-6">
              <Truck className="h-10 w-10 text-blue-600" />
            </div>

            <h2 className="text-3xl font-bold text-gray-900">Create Your Account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {step === 1 ? 'Personal Information' : 'Company Details'}
                </CardTitle>
                <div className="text-xs text-gray-500">
                  Step {step} of 2
                </div>
              </div>
              <div className="flex space-x-2">
                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          {...register('firstName')}
                          className="mt-1"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          {...register('lastName')}
                          className="mt-1"
                        />
                        {errors.lastName && (
                          <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        className="mt-1"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        {...register('password')}
                        className="mt-1"
                      />
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Must be at least 8 characters with letters and numbers
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        {...register('confirmPassword')}
                        className="mt-1"
                      />
                      {errors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={nextStep}
                      className="w-full"
                    >
                      Continue
                    </Button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        {...register('companyName')}
                        className="mt-1"
                      />
                      {errors.companyName && (
                        <p className="mt-1 text-sm text-red-600">{errors.companyName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        {...register('phoneNumber')}
                        className="mt-1"
                      />
                      {errors.phoneNumber && (
                        <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="companySize">Company Size</Label>
                      <Select onValueChange={(value) => setValue('companySize', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select company size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 employees</SelectItem>
                          <SelectItem value="11-50">11-50 employees</SelectItem>
                          <SelectItem value="51-200">51-200 employees</SelectItem>
                          <SelectItem value="201-1000">201-1000 employees</SelectItem>
                          <SelectItem value="1000+">1000+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.companySize && (
                        <p className="mt-1 text-sm text-red-600">{errors.companySize.message}</p>
                      )}
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agreeToTerms"
                          onCheckedChange={(checked: boolean) => setValue('agreeToTerms', checked)}
                        />
                        <div className="text-sm">
                          <Label htmlFor="agreeToTerms" className="cursor-pointer">
                            I agree to the{' '}
                            <Link href="/terms" className="text-blue-600 hover:underline">
                              Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link href="/privacy" className="text-blue-600 hover:underline">
                              Privacy Policy
                            </Link>
                          </Label>
                          {errors.agreeToTerms && (
                            <p className="mt-1 text-red-600">{errors.agreeToTerms.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agreeToMarketing"
                          onCheckedChange={(checked: boolean) => setValue('agreeToMarketing', checked)}
                        />
                        <Label htmlFor="agreeToMarketing" className="text-sm cursor-pointer">
                          Send me product updates and marketing communications
                        </Label>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? 'Creating Account...' : 'Create Account'}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Your data is protected with enterprise-grade encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}