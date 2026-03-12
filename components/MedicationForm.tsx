'use client'

import { useState, useTransition } from 'react'
import { addMedication } from '@/lib/medication-actions'
import type { Person, MedicationFrequency, MedicationType } from '@/lib/types'
import { FREQUENCY_LABELS } from '@/lib/types'
import { todayDateString } from '@/lib/utils'

interface MedicationFormProps {
  people: Person[]
  defaultPersonId: string
  pastMedications: string[]
}

export default function MedicationForm({
  people,
  defaultPersonId,
  pastMedications,
}: MedicationFormProps) {
  const [selectedPerson, setSelectedPerson] = useState(defaultPersonId)
  const [medicationName, setMedicationName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState<MedicationFrequency>('as_needed')
  const [frequencyNotes, setFrequencyNotes] = useState('')
  const [medType, setMedType] = useState<MedicationType>('otc')
  const [prescriber, setPrescriber] = useState('')
  const [startDate, setStartDate] = useState(todayDateString)
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set('person_id', selectedPerson)
    formData.set('medication_name', medicationName)
    formData.set('dosage', dosage)
    formData.set('frequency', frequency)
    formData.set('frequency_notes', frequencyNotes)
    formData.set('med_type', medType)
    formData.set('prescriber', prescriber)
    formData.set('start_date', startDate)
    formData.set('end_date', endDate)
    formData.set('notes', notes)

    startTransition(async () => {
      const result = await addMedication(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setMedicationName('')
        setDosage('')
        setFrequency('as_needed')
        setFrequencyNotes('')
        setMedType('otc')
        setPrescriber('')
        setStartDate(todayDateString())
        setEndDate('')
        setNotes('')
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-4 text-base font-semibold text-gray-800">
        Add a medication
      </h2>

      {success && (
        <div className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-700 ring-1 ring-teal-200">
          Medication added successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Person selector */}
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

        {/* Medication name with autocomplete */}
        <div>
          <label
            htmlFor="medication-name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Medication
          </label>
          <input
            id="medication-name"
            type="text"
            list="medication-suggestions"
            value={medicationName}
            onChange={(e) => setMedicationName(e.target.value)}
            required
            placeholder="e.g. Paracetamol, Amoxicillin, Ibuprofen…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          {pastMedications.length > 0 && (
            <datalist id="medication-suggestions">
              {pastMedications.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </div>

        {/* Dosage */}
        <div>
          <label
            htmlFor="dosage"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Dosage{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="dosage"
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 500mg, 10ml, 1 tablet"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>

        {/* Frequency */}
        <div>
          <label
            htmlFor="frequency"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Frequency
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as MedicationFrequency)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            {(Object.entries(FREQUENCY_LABELS) as [MedicationFrequency, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
          {frequency === 'other' && (
            <input
              type="text"
              value={frequencyNotes}
              onChange={(e) => setFrequencyNotes(e.target.value)}
              placeholder="Describe frequency…"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          )}
        </div>

        {/* Prescribed / OTC toggle */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Type
          </label>
          <div className="flex gap-2">
            {(['prescribed', 'otc'] as MedicationType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMedType(t)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                  medType === t
                    ? t === 'prescribed'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'prescribed' ? 'Prescribed' : 'Over the counter'}
              </button>
            ))}
          </div>
        </div>

        {/* Prescriber (conditional) */}
        {medType === 'prescribed' && (
          <div>
            <label
              htmlFor="prescriber"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Prescribed by{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="prescriber"
              type="text"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
              placeholder="e.g. Dr Smith, dentist"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
        )}

        {/* Date range — Start date / End date */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="start-date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Start date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (endDate && e.target.value > endDate) setEndDate('')
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <div>
              <label
                htmlFor="end-date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                End date{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            End date can be in the future for planned courses (e.g. antibiotics).
          </p>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="med-notes"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Notes{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="med-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details…"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !medicationName.trim()}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Add medication'}
        </button>
      </form>
    </div>
  )
}
