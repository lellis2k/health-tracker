'use client'

import { useState, useTransition } from 'react'
import { signIn, signUp } from '@/lib/auth-actions'

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      if (mode === 'signin') {
        const result = await signIn(formData)
        if (result?.error) setError(result.error)
      } else {
        const result = await signUp(formData)
        if (result?.error) setError(result.error)
        if (result?.message) setMessage(result.message)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      {/* Tab switcher */}
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            mode === 'signin'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            mode === 'signup'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Create account
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-700 ring-1 ring-teal-200">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {isPending
            ? mode === 'signin'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'signin'
            ? 'Sign in'
            : 'Create account'}
        </button>
      </form>
    </div>
  )
}
