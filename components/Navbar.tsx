'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { signOut } from '@/lib/auth-actions'

interface NavbarProps {
  userEmail: string
}

export default function Navbar({ userEmail }: NavbarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        {/* Left: App name + nav links */}
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Health Tracker</span>
          </Link>

          <nav className="hidden gap-4 sm:flex">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Log
            </Link>
            <Link
              href="/dashboard/family"
              className={`text-sm font-medium transition-colors ${
                pathname === '/dashboard/family'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Family
            </Link>
          </nav>
        </div>

        {/* Right: User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700 hover:bg-teal-200"
            aria-label="User menu"
          >
            {userEmail.charAt(0).toUpperCase()}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200">
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="truncate text-sm font-medium text-gray-800">
                    {userEmail}
                  </p>
                </div>

                {/* Mobile nav links */}
                <div className="sm:hidden">
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Log symptoms
                  </Link>
                  <Link
                    href="/dashboard/family"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Manage family
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                </div>

                <button
                  onClick={handleSignOut}
                  disabled={isPending}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {isPending ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
