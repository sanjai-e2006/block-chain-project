'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [adminDepartment, setAdminDepartment] = useState('')
  const [adminId, setAdminId] = useState('')

  // Don't auto-redirect - let users explicitly sign in

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: loginType,
              full_name: fullName,
              ...(loginType === 'admin' && {
                admin_department: adminDepartment,
                admin_id: adminId
              })
            }
          }
        })

        if (error) throw error
        
        if (data.user) {
          // Create user profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                full_name: fullName,
                role: loginType,
                ...(loginType === 'admin' && {
                  admin_department: adminDepartment,
                  admin_id: adminId
                })
              }
            ])

          if (profileError) {
            console.error('Error creating profile:', profileError)
            // Don't throw error here, profile might already exist
          }

          // For development, auto-redirect after signup (in production, you'd verify email first)
          if (loginType === 'admin') {
            router.push('/admin/dashboard')
          } else {
            router.push('/user/dashboard')
          }
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        
        if (data.user) {
          // Check if user profile exists
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { error: createError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: data.user.id,
                  email: data.user.email || email,
                  full_name: data.user.user_metadata?.full_name || 'User',
                  role: loginType
                }
              ])

            if (createError) {
              console.error('Error creating profile:', createError)
              setError('Error creating user profile. Please try again.')
              return
            }
          }

          // Redirect based on role
          if (loginType === 'admin') {
            router.push('/admin/dashboard')
          } else {
            router.push('/user/dashboard')
          }
        }
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600">
              {isSignUp ? 'Sign up for your account' : 'Sign in to your account'}
            </p>
          </div>

          {/* Role Selection */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6 mt-6">
            <button
              type="button"
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                loginType === 'user'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
              onClick={() => setLoginType('user')}
            >
              🧑‍💻 User
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                loginType === 'admin'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
              onClick={() => setLoginType('admin')}
            >
              🛡️ Admin
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="full-name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    id="full-name"
                    name="full-name"
                    type="text"
                    required
                    className="mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                {loginType === 'admin' && (
                  <>
                    <div>
                      <label htmlFor="admin-department" className="block text-sm font-medium text-gray-700">
                        Department
                      </label>
                      <input
                        id="admin-department"
                        name="admin-department"
                        type="text"
                        required
                        className="mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your department"
                        value={adminDepartment}
                        onChange={(e) => setAdminDepartment(e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor="admin-id" className="block text-sm font-medium text-gray-700">
                        Admin ID
                      </label>
                      <input
                        id="admin-id"
                        name="admin-id"
                        type="text"
                        required
                        className="mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your admin ID"
                        value={adminId}
                        onChange={(e) => setAdminId(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </div>
          </form>

          <div className="text-center mt-6">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}