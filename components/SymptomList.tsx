'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  deleteSymptomEntry,
  resolveSymptomEntry,
  updateSymptomEntry,
} from '@/lib/data-actions'
import type { SymptomEntryWithPerson, Person } from '@/lib/types'
import { SEVERITY_LABELS, SEVERITY_CLASSES } from '@/lib/types'
import { todayDateString } from '@/lib/utils'

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

// Parse a YYYY-MM-DD string as local midnight to avoid UTC offset shifting the date
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getDurationBadge(
  entry: SymptomEntryWithPerson
): { text: string; resolved: boolean } | null {
  if (!entry.onset_date) return null
  const onsetMs = parseDateLocal(entry.onset_date).getTime()
  if (!entry.is_resolved) {
    // setHours returns a timestamp directly — no need for an extra new Date() wrapper
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const days = Math.floor((todayMs - onsetMs) / 86400000)
    if (days <= 0) return { text: 'Started today', resolved: false }
    if (days === 1) return { text: 'Started yesterday', resolved: false }
    return { text: `Started ${days} days ago`, resolved: false }
  } else if (entry.resolved_at) {
    const resolvedMs = new Date(entry.resolved_at).setHours(0, 0, 0, 0)
    const days = Math.round((resolvedMs - onsetMs) / 86400000)
    if (days <= 0) return { text: 'Resolved same day', resolved: true }
    if (days === 1) return { text: 'Lasted 1 day', resolved: true }
    return { text: `Lasted ${days} days`, resolved: true }
  }
  return null
}

// Extract a YYYY-MM-DD string from a resolved_at ISO timestamp (stored as T12:00:00.000Z)
function resolvedAtToDate(resolvedAt: string | null): string {
  if (!resolvedAt) return ''
  return new Date(resolvedAt).toISOString().slice(0, 10)
}

interface EditFields {
  symptomName: string
  severity: number
  notes: string
  onsetDate: string
  endedOn: string
}

type StatusFilter = 'all' | 'active' | 'resolved'

// Paired state: null when not editing, populated when editing a specific entry
type EditMode = { entryId: string; fields: EditFields } | null
// Paired state: null when not resolving, populated when resolving a specific entry
type ResolveMode = { entryId: string; date: string } | null

export default function SymptomList({ entries, people }: SymptomListProps) {
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [resolveMode, setResolveMode] = useState<ResolveMode>(null)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [error, setError] = useState<string | null>(null)

  // Separate transitions so each operation's pending state is independent
  const [deletePending, startDeleteTransition] = useTransition()
  const [resolvePending, startResolveTransition] = useTransition()
  const [editPending, startEditTransition] = useTransition()

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => filterPerson === 'all' || e.person_id === filterPerson)
        .filter((e) => {
          if (filterStatus === 'active') return !e.is_resolved
          if (filterStatus === 'resolved') return e.is_resolved
          return true
        }),
    [entries, filterPerson, filterStatus]
  )

  function handleDelete(entryId: string) {
    if (!confirm('Delete this symptom entry?')) return
    setError(null)
    setDeleting(entryId)
    startDeleteTransition(async () => {
      const result = await deleteSymptomEntry(entryId)
      if (result?.error) setError(result.error)
      setDeleting(null)
    })
  }

  function startResolve(entryId: string) {
    setResolveMode({ entryId, date: todayDateString() })
  }

  function handleResolve(entryId: string, date: string) {
    setError(null)
    startResolveTransition(async () => {
      const result = await resolveSymptomEntry(entryId, date)
      if (result?.error) setError(result.error)
      setResolveMode(null)
    })
  }

  function startEdit(entry: SymptomEntryWithPerson) {
    setResolveMode(null)
    setEditMode({
      entryId: entry.id,
      fields: {
        symptomName: entry.symptom_name,
        severity: entry.severity,
        notes: entry.notes ?? '',
        onsetDate: entry.onset_date ?? '',
        endedOn: entry.is_resolved ? resolvedAtToDate(entry.resolved_at) : '',
      },
    })
  }

  function updateEditField<K extends keyof EditFields>(key: K, value: EditFields[K]) {
    setEditMode((m) => m && { ...m, fields: { ...m.fields, [key]: value } })
  }

  function handleSaveEdit(entryId: string) {
    if (!editMode) return
    setError(null)
    const { fields } = editMode
    const formData = new FormData()
    formData.set('symptom_name', fields.symptomName)
    formData.set('severity', String(fields.severity))
    formData.set('notes', fields.notes)
    formData.set('onset_date', fields.onsetDate)
    formData.set('ended_on', fields.endedOn)
    startEditTransition(async () => {
      const result = await updateSymptomEntry(entryId, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setEditMode(null)
      }
    })
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-400">
          No entries yet. Log a symptom above.
        </p>
      </div>
    )
  }

  const today = todayDateString()

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {(['all', 'active', 'resolved'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-all ${
                filterStatus === s
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {people.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPerson('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                filterPerson === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All people
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setFilterPerson(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filterPerson === p.id
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          No{filterStatus !== 'all' ? ` ${filterStatus}` : ''} entries
          {filterPerson !== 'all' ? ' for this person' : ''}.
        </p>
      )}

      {filtered.map((entry) => {
        const duration = getDurationBadge(entry)
        const canResolve = !!entry.onset_date && !entry.is_resolved
        const isEditing = editMode?.entryId === entry.id
        const isResolving = resolveMode?.entryId === entry.id

        return (
          <div
            key={entry.id}
            className={`group relative rounded-xl bg-white p-4 shadow-sm ring-1 transition-shadow hover:shadow-md ${
              entry.is_resolved && !isEditing
                ? 'ring-gray-100 opacity-75'
                : 'ring-gray-200'
            }`}
          >
            {isEditing && editMode ? (
              /* ── Inline edit form ── */
              <div className="space-y-3">
                {/* Symptom name */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Symptom
                  </label>
                  <input
                    type="text"
                    value={editMode.fields.symptomName}
                    onChange={(e) => updateEditField('symptomName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Severity
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={editMode.fields.severity}
                      onChange={(e) => updateEditField('severity', Number(e.target.value))}
                      className="flex-1 accent-teal-600"
                    />
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[editMode.fields.severity]}`}
                    >
                      {editMode.fields.severity} – {SEVERITY_LABELS[editMode.fields.severity]}
                    </span>
                  </div>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Started on
                    </label>
                    <input
                      type="date"
                      value={editMode.fields.onsetDate}
                      onChange={(e) => {
                        const val = e.target.value
                        updateEditField('onsetDate', val)
                        // Clear end date if it's now before the new start
                        if (editMode.fields.endedOn && val > editMode.fields.endedOn) {
                          updateEditField('endedOn', '')
                        }
                      }}
                      max={today}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Ended on{' '}
                      <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={editMode.fields.endedOn}
                      onChange={(e) => updateEditField('endedOn', e.target.value)}
                      min={editMode.fields.onsetDate || undefined}
                      max={today}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Notes{' '}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={editMode.fields.notes}
                    onChange={(e) => updateEditField('notes', e.target.value)}
                    rows={2}
                    placeholder="Any additional details…"
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(entry.id)}
                    disabled={editPending || !editMode.fields.symptomName.trim()}
                    className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {editPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditMode(null)}
                    className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal card view ── */
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Symptom name + badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-medium ${entry.is_resolved ? 'text-gray-500' : 'text-gray-900'}`}
                    >
                      {entry.symptom_name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[entry.severity]}`}
                    >
                      {entry.severity} – {SEVERITY_LABELS[entry.severity]}
                    </span>
                    {duration && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          duration.resolved
                            ? 'bg-green-50 text-green-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {duration.text}
                      </span>
                    )}
                  </div>

                  {/* Person + logged date */}
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

                  {/* Mark resolved — button or inline date picker */}
                  {canResolve && (
                    isResolving && resolveMode ? (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={resolveMode.date}
                          onChange={(e) =>
                            setResolveMode({ ...resolveMode, date: e.target.value })
                          }
                          min={entry.onset_date ?? undefined}
                          max={today}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
                        />
                        <button
                          onClick={() => handleResolve(entry.id, resolveMode.date)}
                          disabled={!resolveMode.date || resolvePending}
                          className="text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50"
                        >
                          {resolvePending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setResolveMode(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startResolve(entry.id)}
                        className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        ✓ Mark resolved
                      </button>
                    )
                  )}
                </div>

                {/* Edit + Delete buttons (visible on hover) */}
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(entry)}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
                    aria-label="Edit entry"
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
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletePending && deleting === entry.id}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
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
            )}
          </div>
        )
      })}
    </div>
  )
}
