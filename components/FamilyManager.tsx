'use client'

import { useState, useTransition } from 'react'
import { addPerson, updateFamilyName, updatePersonName } from '@/lib/data-actions'
import type { Family, Person } from '@/lib/types'

interface FamilyManagerProps {
  family: Family
  people: Person[]
  isAdmin: boolean
  currentUserId: string
}

export default function FamilyManager({
  family,
  people,
  isAdmin,
  currentUserId,
}: FamilyManagerProps) {
  const [editingFamilyName, setEditingFamilyName] = useState(false)
  const [familyName, setFamilyName] = useState(family.name)
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState('')
  const [newPersonName, setNewPersonName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  function handleUpdateFamilyName(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateFamilyName(family.id, familyName)
      if (result.error) setError(result.error)
      else {
        setEditingFamilyName(false)
        showSuccess('Family name updated.')
      }
    })
  }

  function handleUpdatePersonName(e: React.FormEvent, personId: string) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updatePersonName(personId, editingPersonName)
      if (result.error) setError(result.error)
      else {
        setEditingPersonId(null)
        showSuccess('Name updated.')
      }
    })
  }

  function handleAddPerson(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('display_name', newPersonName)
    formData.set('family_id', family.id)

    startTransition(async () => {
      const result = await addPerson(formData)
      if (result.error) setError(result.error)
      else {
        setNewPersonName('')
        showSuccess(`${newPersonName} added to the family.`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Family</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your family group and the people you track symptoms for.
        </p>
      </div>

      {success && (
        <div className="rounded-lg bg-teal-50 p-3 text-sm text-teal-700 ring-1 ring-teal-200">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Family name */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Family name
            </h2>
            {editingFamilyName ? (
              <form
                onSubmit={handleUpdateFamilyName}
                className="mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingFamilyName(false)
                    setFamilyName(family.name)
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p className="mt-1 text-lg font-medium text-gray-900">
                {familyName}
              </p>
            )}
          </div>
          {isAdmin && !editingFamilyName && (
            <button
              onClick={() => setEditingFamilyName(true)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* People list */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            People ({people.length})
          </h2>
        </div>

        <ul className="divide-y divide-gray-100">
          {people.map((person) => (
            <li key={person.id} className="px-5 py-4">
              {editingPersonId === person.id ? (
                <form
                  onSubmit={(e) => handleUpdatePersonName(e, person.id)}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={editingPersonName}
                    onChange={(e) => setEditingPersonName(e.target.value)}
                    required
                    autoFocus
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPersonId(null)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                      {person.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {person.display_name}
                      </p>
                      {person.user_id && (
                        <p className="text-xs text-gray-400">
                          {person.user_id === currentUserId
                            ? 'You'
                            : 'Has account'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingPersonId(person.id)
                      setEditingPersonName(person.display_name)
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Rename
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Add person */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Add a family member
        </h2>
        <form onSubmit={handleAddPerson} className="flex gap-2">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            required
            placeholder="Name (e.g. Emma, Dad)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <button
            type="submit"
            disabled={isPending || !newPersonName.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          Add family members (e.g. children) to track their symptoms too.
        </p>
      </div>
    </div>
  )
}
