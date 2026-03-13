'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MEDICATION_NAMES } from '@/lib/medication-names'

export interface ActiveMedication {
  id: string
  medication_name: string
  dosage: string | null
}

interface MedicationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Currently active medications for the selected person (shown first with dosage) */
  activeMedications?: ActiveMedication[]
  /** Previously-used medication names (shown with priority) */
  pastMedications?: string[]
  /** Callback when user selects an active medication (provides ID + dosage for auto-fill) */
  onSelectMedication?: (med: ActiveMedication) => void
  placeholder?: string
  className?: string
  id?: string
  name?: string
  required?: boolean
}

type SuggestionType = 'active' | 'past' | 'nhs'

interface Suggestion {
  label: string
  sublabel?: string
  type: SuggestionType
  activeMed?: ActiveMedication
}

export default function MedicationAutocomplete({
  value,
  onChange,
  activeMedications = [],
  pastMedications = [],
  onSelectMedication,
  placeholder = 'e.g. Paracetamol, Amoxicillin…',
  className = '',
  id,
  name,
  required,
}: MedicationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return []
    const lower = value.toLowerCase()
    const seen = new Set<string>()
    const results: Suggestion[] = []

    // 1. Active medications first (with dosage)
    for (const med of activeMedications) {
      const medLower = med.medication_name.toLowerCase()
      // Unique key includes dosage to allow "Paracetamol 500mg" and "Paracetamol 1000mg"
      const key = `${medLower}::${(med.dosage ?? '').toLowerCase()}`
      if (medLower.includes(lower) && !seen.has(key)) {
        seen.add(key)
        results.push({
          label: med.medication_name,
          sublabel: med.dosage ?? undefined,
          type: 'active',
          activeMed: med,
        })
      }
    }

    // 2. Past medication names (not already shown as active)
    const activeNames = new Set(activeMedications.map((m) => m.medication_name.toLowerCase()))
    for (const med of pastMedications) {
      const medLower = med.toLowerCase()
      if (medLower.includes(lower) && !activeNames.has(medLower) && !seen.has(medLower)) {
        seen.add(medLower)
        results.push({ label: med, type: 'past' })
      }
    }

    // 3. NHS list: starts-with first, then contains
    const startsWithMatches: string[] = []
    const containsMatches: string[] = []
    for (const med of MEDICATION_NAMES) {
      const medLower = med.toLowerCase()
      if (seen.has(medLower)) continue
      if (medLower.startsWith(lower)) {
        startsWithMatches.push(med)
      } else if (medLower.includes(lower)) {
        containsMatches.push(med)
      }
    }
    for (const med of [...startsWithMatches, ...containsMatches]) {
      seen.add(med.toLowerCase())
      results.push({ label: med, type: 'nhs' })
    }

    return results.slice(0, 8)
  }, [value, activeMedications, pastMedications])

  const showDropdown = isOpen && suggestions.length > 0

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const selectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      onChange(suggestion.label)
      if (suggestion.type === 'active' && suggestion.activeMed && onSelectMedication) {
        onSelectMedication(suggestion.activeMed)
      }
      setIsOpen(false)
      setHighlightIndex(-1)
      inputRef.current?.focus()
    },
    [onChange, onSelectMedication]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[highlightIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  const typeLabel: Record<SuggestionType, string> = {
    active: 'active',
    past: 'used before',
    nhs: '',
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
          setHighlightIndex(-1)
        }}
        onFocus={() => {
          if (value.length >= 1) setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls={showDropdown ? 'med-autocomplete-list' : undefined}
        aria-activedescendant={
          highlightIndex >= 0 ? `med-option-${highlightIndex}` : undefined
        }
        className={className}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          id="med-autocomplete-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((suggestion, i) => {
            // Highlight the matching portion in the label
            const lower = value.toLowerCase()
            const idx = suggestion.label.toLowerCase().indexOf(lower)
            const before = suggestion.label.slice(0, idx)
            const match = suggestion.label.slice(idx, idx + value.length)
            const after = suggestion.label.slice(idx + value.length)

            // Show section divider between different types
            const prevType = i > 0 ? suggestions[i - 1].type : null
            const showDivider = prevType !== null && prevType !== suggestion.type

            const badge = typeLabel[suggestion.type]

            return (
              <li
                key={`${suggestion.type}-${suggestion.label}-${suggestion.sublabel ?? ''}`}
                id={`med-option-${i}`}
                role="option"
                aria-selected={i === highlightIndex}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectSuggestion(suggestion)
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  showDivider ? 'border-t border-gray-100' : ''
                } ${
                  i === highlightIndex
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>
                    {before}
                    <span className="font-semibold">{match}</span>
                    {after}
                    {suggestion.sublabel && (
                      <span className="ml-1 text-gray-400">· {suggestion.sublabel}</span>
                    )}
                  </span>
                  {badge && (
                    <span
                      className={`ml-auto shrink-0 text-[10px] ${
                        suggestion.type === 'active'
                          ? 'font-medium text-teal-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
