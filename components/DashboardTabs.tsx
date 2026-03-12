'use client'

import { useRouter } from 'next/navigation'

interface DashboardTabsProps {
  activeTab: 'symptoms' | 'medications'
}

export default function DashboardTabs({ activeTab }: DashboardTabsProps) {
  const router = useRouter()

  return (
    <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
      <button
        onClick={() => router.push('/dashboard?tab=symptoms')}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
          activeTab === 'symptoms'
            ? 'bg-white text-teal-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Symptoms
      </button>
      <button
        onClick={() => router.push('/dashboard?tab=medications')}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
          activeTab === 'medications'
            ? 'bg-white text-teal-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Medications
      </button>
    </div>
  )
}
