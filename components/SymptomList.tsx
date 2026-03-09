'use client'

import { useState, useTransition } from 'react'
import { deleteSymptomEntry } from '@/lib/data-actions'
import type { SymptomEntryWithPerson, Person } from '@/lib/types'
import { SEVERITY_LABELS, SEVERITY_CLASSES } from '@/lib/types'

interface SymptomListProps {
  entries: SymptomEntryWithPerson[]
  people: Person[]
}

function formatDate(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86400000
  )

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (diffDays === 0) return `Today, ${timeStr}`
  if (diffDays === 1) return `Yesterday, ${timeStr}`
  return (
    date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) +
    ', ' +
    timeStr
  )
}

export default function SymptomList({ entries, people }: SymptomListProps) {
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered =
    filterPerson === 'all'
      ? entries
      : entries.filter((e) => e.person_id === filterPerson)

  function handleDelete(entryId: string) {
    if (!confirm('Delete this symptom entry?')) return
    setDeleting(entryId)
    startTransition(async () => {
      await deleteSymptomEntry(entryId)
      setDeleting(null)
    })
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-400">No entries yet. Log a symptom above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Person filter (only show if >1 person) */}
      {people.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterPerson('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              filterPerson === 'all'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterPerson(p.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                filterPerson === p.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          No entries for this person.
        </p>
      )}

      {filtered.map((entry) => (
        <div
          key={entry.id}
          className="group relative rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Symptom name + severity */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">
                  {entry.symptom_name}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[entry.severity]}`}
                >
                  {entry.severity} – {SEVERITY_LABELS[entry.severity]}
                </span>
              </div>

              {/* Person + date */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {people.length > 1 && entry.person && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                    {entry.person.display_name}
                  </span>
                )}
                <span>{formatDate(entry.logged_at)}</span>
              </div>

              {/* Notes */}
              {entry.notes && (
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                  {entry.notes}
                </p>
              )}
            </div>

            {/* Delete button */}
            <button
              onClick={() => handleDelete(entry.id)}
              disabled={isPending && deleting === entry.id}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              aria-label="Delete entry"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
