'use client'

import { useState, useTransition } from 'react'
import { quickLogDose } from '@/lib/medication-actions'
import type { Person, Medication } from '@/lib/types'
import MedicationAutocomplete, { type ActiveMedication } from './MedicationAutocomplete'

interface QuickDoseBarProps {
  people: Person[]
  defaultPersonId: string
  medications: Medication[]
  pastMedications: string[]
}

export default function QuickDoseBar({
  people,
  defaultPersonId,
  medications,
  pastMedications,
}: QuickDoseBarProps) {
  const [selectedPerson, setSelectedPerson] = useState(defaultPersonId)
  const [medicationName, setMedicationName] = useState('')
  const [dosage, setDosage] = useState('')
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Active medications for the currently selected person
  const activeMedsForPerson: ActiveMedication[] = medications
    .filter((m) => m.person_id === selectedPerson && m.is_active)
    .map((m) => ({
      id: m.id,
      medication_name: m.medication_name,
      dosage: m.dosage,
    }))

  function handleSelectMedication(med: ActiveMedication) {
    setSelectedMedId(med.id)
    if (med.dosage) setDosage(med.dosage)
  }

  function handleNameChange(name: string) {
    setMedicationName(name)
    // Clear selected med ID if user is typing something different
    setSelectedMedId(null)
  }

  function handlePersonChange(personId: string) {
    setSelectedPerson(personId)
    // Reset selection when person changes
    setSelectedMedId(null)
    setDosage('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!medicationName.trim()) return

    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.set('person_id', selectedPerson)
    formData.set('medication_name', medicationName.trim())
    if (dosage.trim()) formData.set('dosage', dosage.trim())
    if (selectedMedId) formData.set('existing_medication_id', selectedMedId)

    startTransition(async () => {
      const result = await quickLogDose(formData)
      if (result?.error) {
        if (result.error === 'multiple_matches') {
          setError('Multiple medications match — please select a specific one from the dropdown.')
        } else {
          setError(result.error)
        }
      } else {
        setSuccess(`${medicationName} dose logged`)
        setMedicationName('')
        setDosage('')
        setSelectedMedId(null)
        setTimeout(() => setSuccess(null), 3000)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">Quick dose</h2>

      {success && (
        <div className="mb-3 rounded-lg bg-teal-50 p-2.5 text-sm text-teal-700 ring-1 ring-teal-200">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Person selector — only if multiple people */}
        {people.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePersonChange(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedPerson === p.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        )}

        {/* Input row: medication + dosage + button */}
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <MedicationAutocomplete
              value={medicationName}
              onChange={handleNameChange}
              activeMedications={activeMedsForPerson}
              pastMedications={pastMedications}
              onSelectMedication={handleSelectMedication}
              placeholder="What did you take?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="Dosage"
            className="w-24 rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <button
            type="submit"
            disabled={isPending || !medicationName.trim()}
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {isPending ? 'Logging…' : 'Took it'}
          </button>
        </div>
      </form>
    </div>
  )
}
