'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  deleteMedication,
  discontinueMedication,
  reactivateMedication,
  updateMedication,
  logDose,
  deleteDose,
} from '@/lib/medication-actions'
import type {
  MedicationWithPerson,
  MedicationDose,
  Person,
  MedicationFrequency,
  MedicationType,
} from '@/lib/types'
import { FREQUENCY_LABELS } from '@/lib/types'
import { todayDateString } from '@/lib/utils'

interface MedicationListProps {
  medications: MedicationWithPerson[]
  doses: MedicationDose[]
  people: Person[]
}

function getTimeSinceLastDose(
  medicationId: string,
  doses: MedicationDose[]
): string | null {
  const medDoses = doses.filter((d) => d.medication_id === medicationId)
  if (medDoses.length === 0) return null
  const lastDose = new Date(medDoses[0].taken_at)
  const now = new Date()
  const diffMs = now.getTime() - lastDose.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

function formatDoseTime(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000
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

interface EditFields {
  medicationName: string
  dosage: string
  frequency: MedicationFrequency
  frequencyNotes: string
  medType: MedicationType
  prescriber: string
  startDate: string
  endDate: string
  notes: string
}

type StatusFilter = 'all' | 'active' | 'discontinued'
type EditMode = { medId: string; fields: EditFields } | null
type DiscontinueMode = { medId: string; date: string } | null
type DoseLogMode = { medId: string; customTime: string; notes: string } | null

export default function MedicationList({
  medications,
  doses,
  people,
}: MedicationListProps) {
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [discontinueMode, setDiscontinueMode] = useState<DiscontinueMode>(null)
  const [doseLogMode, setDoseLogMode] = useState<DoseLogMode>(null)
  const [expandedDoses, setExpandedDoses] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [doseSuccess, setDoseSuccess] = useState<string | null>(null)

  const [deletePending, startDeleteTransition] = useTransition()
  const [discontinuePending, startDiscontinueTransition] = useTransition()
  const [editPending, startEditTransition] = useTransition()
  const [dosePending, startDoseTransition] = useTransition()
  const [doseDeletePending, startDoseDeleteTransition] = useTransition()

  const filtered = useMemo(
    () =>
      medications
        .filter((m) => filterPerson === 'all' || m.person_id === filterPerson)
        .filter((m) => {
          if (filterStatus === 'active') return m.is_active
          if (filterStatus === 'discontinued') return !m.is_active
          return true
        }),
    [medications, filterPerson, filterStatus]
  )

  function handleDelete(medId: string) {
    if (!confirm('Delete this medication and all its dose history?')) return
    setError(null)
    startDeleteTransition(async () => {
      const result = await deleteMedication(medId)
      if (result?.error) setError(result.error)
    })
  }

  function handleDiscontinue(medId: string, date: string) {
    setError(null)
    startDiscontinueTransition(async () => {
      const result = await discontinueMedication(medId, date)
      if (result?.error) setError(result.error)
      setDiscontinueMode(null)
    })
  }

  function handleReactivate(medId: string) {
    setError(null)
    startDiscontinueTransition(async () => {
      const result = await reactivateMedication(medId)
      if (result?.error) setError(result.error)
    })
  }

  function startEdit(med: MedicationWithPerson) {
    setDiscontinueMode(null)
    setDoseLogMode(null)
    setEditMode({
      medId: med.id,
      fields: {
        medicationName: med.medication_name,
        dosage: med.dosage ?? '',
        frequency: med.frequency,
        frequencyNotes: med.frequency_notes ?? '',
        medType: med.med_type,
        prescriber: med.prescriber ?? '',
        startDate: med.start_date ?? '',
        endDate: med.end_date ?? '',
        notes: med.notes ?? '',
      },
    })
  }

  function updateEditField<K extends keyof EditFields>(key: K, value: EditFields[K]) {
    setEditMode((m) => m && { ...m, fields: { ...m.fields, [key]: value } })
  }

  function handleSaveEdit(medId: string) {
    if (!editMode) return
    setError(null)
    const { fields } = editMode
    const formData = new FormData()
    formData.set('medication_name', fields.medicationName)
    formData.set('dosage', fields.dosage)
    formData.set('frequency', fields.frequency)
    formData.set('frequency_notes', fields.frequencyNotes)
    formData.set('med_type', fields.medType)
    formData.set('prescriber', fields.prescriber)
    formData.set('start_date', fields.startDate)
    formData.set('end_date', fields.endDate)
    formData.set('notes', fields.notes)
    startEditTransition(async () => {
      const result = await updateMedication(medId, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setEditMode(null)
      }
    })
  }

  function handleQuickDose(medId: string) {
    setError(null)
    const formData = new FormData()
    formData.set('medication_id', medId)
    formData.set('taken_at', new Date().toISOString())
    formData.set('notes', '')
    startDoseTransition(async () => {
      const result = await logDose(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setDoseSuccess(medId)
        setTimeout(() => setDoseSuccess(null), 2000)
      }
    })
  }

  function handleCustomDose(medId: string) {
    if (!doseLogMode) return
    setError(null)
    const formData = new FormData()
    formData.set('medication_id', medId)
    formData.set(
      'taken_at',
      doseLogMode.customTime
        ? new Date(doseLogMode.customTime).toISOString()
        : new Date().toISOString()
    )
    formData.set('notes', doseLogMode.notes)
    startDoseTransition(async () => {
      const result = await logDose(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setDoseLogMode(null)
        setDoseSuccess(medId)
        setTimeout(() => setDoseSuccess(null), 2000)
      }
    })
  }

  function handleDeleteDose(doseId: string) {
    setError(null)
    startDoseDeleteTransition(async () => {
      const result = await deleteDose(doseId)
      if (result?.error) setError(result.error)
    })
  }

  function toggleDoseHistory(medId: string) {
    setExpandedDoses((prev) => {
      const next = new Set(prev)
      if (next.has(medId)) next.delete(medId)
      else next.add(medId)
      return next
    })
  }

  if (medications.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-400">
          No medications yet. Add one above.
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
          {(['all', 'active', 'discontinued'] as StatusFilter[]).map((s) => (
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
          No{filterStatus !== 'all' ? ` ${filterStatus}` : ''} medications
          {filterPerson !== 'all' ? ' for this person' : ''}.
        </p>
      )}

      {filtered.map((med) => {
        const lastDoseText = getTimeSinceLastDose(med.id, doses)
        const medDoses = doses
          .filter((d) => d.medication_id === med.id)
          .slice(0, 10)
        const isEditing = editMode?.medId === med.id
        const isDiscontinuing = discontinueMode?.medId === med.id
        const isDoseLog = doseLogMode?.medId === med.id

        return (
          <div
            key={med.id}
            className={`group relative rounded-xl bg-white p-4 shadow-sm ring-1 transition-shadow hover:shadow-md ${
              !med.is_active && !isEditing
                ? 'ring-gray-100 opacity-75'
                : 'ring-gray-200'
            }`}
          >
            {isEditing && editMode ? (
              /* ── Inline edit form ── */
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Medication
                  </label>
                  <input
                    type="text"
                    value={editMode.fields.medicationName}
                    onChange={(e) => updateEditField('medicationName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Dosage
                  </label>
                  <input
                    type="text"
                    value={editMode.fields.dosage}
                    onChange={(e) => updateEditField('dosage', e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Frequency
                  </label>
                  <select
                    value={editMode.fields.frequency}
                    onChange={(e) =>
                      updateEditField('frequency', e.target.value as MedicationFrequency)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    {(
                      Object.entries(FREQUENCY_LABELS) as [MedicationFrequency, string][]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {editMode.fields.frequency === 'other' && (
                    <input
                      type="text"
                      value={editMode.fields.frequencyNotes}
                      onChange={(e) => updateEditField('frequencyNotes', e.target.value)}
                      placeholder="Describe frequency…"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Type
                  </label>
                  <div className="flex gap-2">
                    {(['prescribed', 'otc'] as MedicationType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateEditField('medType', t)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          editMode.fields.medType === t
                            ? t === 'prescribed'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t === 'prescribed' ? 'Prescribed' : 'OTC'}
                      </button>
                    ))}
                  </div>
                </div>

                {editMode.fields.medType === 'prescribed' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Prescribed by
                    </label>
                    <input
                      type="text"
                      value={editMode.fields.prescriber}
                      onChange={(e) => updateEditField('prescriber', e.target.value)}
                      placeholder="e.g. Dr Smith"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={editMode.fields.startDate}
                      onChange={(e) => {
                        updateEditField('startDate', e.target.value)
                        if (editMode.fields.endDate && e.target.value > editMode.fields.endDate) {
                          updateEditField('endDate', '')
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      End date{' '}
                      <span className="font-normal text-gray-400">(opt)</span>
                    </label>
                    <input
                      type="date"
                      value={editMode.fields.endDate}
                      onChange={(e) => updateEditField('endDate', e.target.value)}
                      min={editMode.fields.startDate || undefined}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Notes
                  </label>
                  <textarea
                    value={editMode.fields.notes}
                    onChange={(e) => updateEditField('notes', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(med.id)}
                    disabled={editPending || !editMode.fields.medicationName.trim()}
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
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Name + badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-medium ${!med.is_active ? 'text-gray-500' : 'text-gray-900'}`}
                      >
                        {med.medication_name}
                      </span>
                      {med.dosage && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {med.dosage}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          med.med_type === 'prescribed'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {med.med_type === 'prescribed' ? 'Rx' : 'OTC'}
                      </span>
                      {lastDoseText && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Last: {lastDoseText}
                        </span>
                      )}
                      {!med.is_active && (
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Discontinued
                        </span>
                      )}
                    </div>

                    {/* Frequency + person + prescriber */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{FREQUENCY_LABELS[med.frequency]}</span>
                      {med.frequency === 'other' && med.frequency_notes && (
                        <span>({med.frequency_notes})</span>
                      )}
                      {med.prescriber && (
                        <span>
                          · {med.prescriber}
                        </span>
                      )}
                      {people.length > 1 && med.person && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                          {med.person.display_name}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {med.notes && (
                      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                        {med.notes}
                      </p>
                    )}

                    {/* Dose success toast */}
                    {doseSuccess === med.id && (
                      <div className="mt-2 rounded-lg bg-teal-50 p-2 text-xs text-teal-700 ring-1 ring-teal-200">
                        Dose logged
                      </div>
                    )}

                    {/* Quick dose + discontinue actions */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {med.is_active && (
                        <>
                          <button
                            onClick={() => handleQuickDose(med.id)}
                            disabled={dosePending}
                            className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                          >
                            {dosePending ? 'Logging…' : 'Log dose'}
                          </button>
                          <button
                            onClick={() =>
                              setDoseLogMode(
                                isDoseLog
                                  ? null
                                  : {
                                      medId: med.id,
                                      customTime: '',
                                      notes: '',
                                    }
                              )
                            }
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            {isDoseLog ? 'Cancel' : '+ Custom time'}
                          </button>
                        </>
                      )}

                      {med.is_active ? (
                        isDiscontinuing && discontinueMode ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={discontinueMode.date}
                              onChange={(e) =>
                                setDiscontinueMode({
                                  ...discontinueMode,
                                  date: e.target.value,
                                })
                              }
                              max={today}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
                            />
                            <button
                              onClick={() =>
                                handleDiscontinue(med.id, discontinueMode.date)
                              }
                              disabled={!discontinueMode.date || discontinuePending}
                              className="text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
                            >
                              {discontinuePending ? 'Saving…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDiscontinueMode(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setDiscontinueMode({
                                medId: med.id,
                                date: todayDateString(),
                              })
                            }
                            className="text-xs font-medium text-orange-600 hover:text-orange-700"
                          >
                            Discontinue
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleReactivate(med.id)}
                          disabled={discontinuePending}
                          className="text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>

                    {/* Custom dose log form */}
                    {isDoseLog && doseLogMode && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          value={doseLogMode.customTime}
                          onChange={(e) =>
                            setDoseLogMode({
                              ...doseLogMode,
                              customTime: e.target.value,
                            })
                          }
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
                        />
                        <input
                          type="text"
                          value={doseLogMode.notes}
                          onChange={(e) =>
                            setDoseLogMode({ ...doseLogMode, notes: e.target.value })
                          }
                          placeholder="Note (optional)"
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
                        />
                        <button
                          onClick={() => handleCustomDose(med.id)}
                          disabled={dosePending || !doseLogMode.customTime}
                          className="text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50"
                        >
                          {dosePending ? 'Logging…' : 'Log'}
                        </button>
                      </div>
                    )}

                    {/* Dose history toggle */}
                    {medDoses.length > 0 && (
                      <button
                        onClick={() => toggleDoseHistory(med.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className={`h-3 w-3 transition-transform ${expandedDoses.has(med.id) ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m9 5 7 7-7 7"
                          />
                        </svg>
                        {medDoses.length} dose{medDoses.length !== 1 ? 's' : ''} logged
                      </button>
                    )}

                    {/* Expanded dose history */}
                    {expandedDoses.has(med.id) && medDoses.length > 0 && (
                      <div className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
                        {medDoses.map((dose) => (
                          <div
                            key={dose.id}
                            className="group/dose flex items-center gap-2 text-xs text-gray-500"
                          >
                            <span>{formatDoseTime(dose.taken_at)}</span>
                            {dose.notes && (
                              <span className="text-gray-400">· {dose.notes}</span>
                            )}
                            <button
                              onClick={() => handleDeleteDose(dose.id)}
                              disabled={doseDeletePending}
                              className="ml-auto rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover/dose:opacity-100 disabled:opacity-50"
                              aria-label="Delete dose"
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18 18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit + Delete buttons (visible on hover) */}
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(med)}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
                      aria-label="Edit medication"
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
                      onClick={() => handleDelete(med.id)}
                      disabled={deletePending}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      aria-label="Delete medication"
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
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
