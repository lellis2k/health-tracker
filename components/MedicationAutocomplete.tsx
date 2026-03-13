'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MEDICATION_NAMES } from '@/lib/medication-names'

interface MedicationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Previously-used medication names (shown with priority) */
  pastMedications?: string[]
  placeholder?: string
  className?: string
  id?: string
  name?: string
  required?: boolean
}

export default function MedicationAutocomplete({
  value,
  onChange,
  pastMedications = [],
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
    const results: { name: string; isPast: boolean }[] = []

    // Past medications first (user history)
    for (const med of pastMedications) {
      const medLower = med.toLowerCase()
      if (medLower.includes(lower) && !seen.has(medLower)) {
        seen.add(medLower)
        results.push({ name: med, isPast: true })
      }
    }

    // Then NHS list: starts-with first, then contains
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
      results.push({ name: med, isPast: false })
    }

    return results.slice(0, 8)
  }, [value, pastMedications])

  const showDropdown = isOpen && suggestions.length > 0
  const hasPastSection = suggestions.some((s) => s.isPast)
  const hasNhsSection = suggestions.some((s) => !s.isPast)

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
    (name: string) => {
      onChange(name)
      setIsOpen(false)
      setHighlightIndex(-1)
      inputRef.current?.focus()
    },
    [onChange]
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
      selectSuggestion(suggestions[highlightIndex].name)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
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
            // Highlight the matching portion
            const lower = value.toLowerCase()
            const idx = suggestion.name.toLowerCase().indexOf(lower)
            const before = suggestion.name.slice(0, idx)
            const match = suggestion.name.slice(idx, idx + value.length)
            const after = suggestion.name.slice(idx + value.length)

            // Show section divider between past and NHS suggestions
            const showDivider =
              i > 0 &&
              !suggestion.isPast &&
              suggestions[i - 1].isPast

            return (
              <li
                key={suggestion.name}
                id={`med-option-${i}`}
                role="option"
                aria-selected={i === highlightIndex}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectSuggestion(suggestion.name)
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
                  </span>
                  {suggestion.isPast && (
                    <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                      used before
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
