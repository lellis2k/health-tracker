'use client'

import { useState, useTransition, useRef } from 'react'
import { addSymptomEntry } from '@/lib/data-actions'
import type { Person } from '@/lib/types'
import { SEVERITY_LABELS, SEVERITY_CLASSES } from '@/lib/types'

interface SymptomFormProps {
  people: Person[]
  defaultPersonId: string
  pastSymptoms: string[]
}

function localDatetimeDefault() {
  const now = new Date()
  // Format: YYYY-MM-DDTHH:MM (local time, no timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function SymptomForm({
  people,
  defaultPersonId,
  pastSymptoms,
}: SymptomFormProps) {
  const [selectedPerson, setSelectedPerson] = useState(defaultPersonId)
  const [symptomName, setSymptomName] = useState('')
  const [severity, setSeverity] = useState<number>(3)
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState(localDatetimeDefault)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set('person_id', selectedPerson)
    formData.set('symptom_name', symptomName)
    formData.set('severity', String(severity))
    formData.set('notes', notes)
    // Convert local datetime to ISO string
    const localDate = new Date(loggedAt)
    formData.set('logged_at', localDate.toISOString())

    startTransition(async () => {
      const result = await addSymptomEntry(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setSymptomName('')
        setNotes('')
        setSeverity(3)
        setLoggedAt(localDatetimeDefault())
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  const severityColor = SEVERITY_CLASSES[severity]
  const severityLabel = SEVERITY_LABELS[severity]

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-4 text-base font-semibold text-gray-800">
        Log a symptom
      </h2>

      {success && (
        <div className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-700 ring-1 ring-teal-200">
          Symptom logged successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Person selector (tabs if few people, dropdown if many) */}
        {people.length > 1 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              For
            </label>
            {people.length <= 4 ? (
              <div className="flex gap-2 flex-wrap">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPerson(p.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                      selectedPerson === p.id
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Symptom name with autocomplete */}
        <div>
          <label
            htmlFor="symptom-name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Symptom
          </label>
          <input
            id="symptom-name"
            type="text"
            list="symptom-suggestions"
            value={symptomName}
            onChange={(e) => setSymptomName(e.target.value)}
            required
            placeholder="e.g. Headache, Fatigue, Cough…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          {pastSymptoms.length > 0 && (
            <datalist id="symptom-suggestions">
              {pastSymptoms.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </div>

        {/* Severity */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Severity
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1 – Mild</span>
              <span>3 – Moderate</span>
              <span>5 – Severe</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColor}`}
              >
                {severity} – {severityLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Date/time */}
        <div>
          <label
            htmlFor="logged-at"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            When
          </label>
          <input
            id="logged-at"
            type="datetime-local"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Notes{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details…"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !symptomName.trim()}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Log symptom'}
        </button>
      </form>
    </div>
  )
}
