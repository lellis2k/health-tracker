export interface Family {
  id: string
  name: string
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: 'admin' | 'member'
  created_at: string
}

export interface Person {
  id: string
  family_id: string
  user_id: string | null
  display_name: string
  created_at: string
}

export interface SymptomEntry {
  id: string
  person_id: string
  family_id: string
  symptom_name: string
  severity: 1 | 2 | 3 | 4 | 5
  notes: string | null
  logged_at: string
  created_by: string | null
  created_at: string
  // Duration tracking
  onset_date: string | null    // ISO date "YYYY-MM-DD", null = point-in-time log
  is_resolved: boolean
  resolved_at: string | null   // ISO timestamptz
  // joined
  person?: Person
}

export interface SymptomEntryWithPerson extends SymptomEntry {
  person: Person
}

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Mild',
  2: 'Mild–Moderate',
  3: 'Moderate',
  4: 'Moderate–Severe',
  5: 'Severe',
}

export const SEVERITY_CLASSES: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-lime-100 text-lime-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-red-100 text-red-800',
}

// ============================================================
// MEDICATION TRACKING
// ============================================================

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_daily'
  | 'four_daily'
  | 'every_8_hours'
  | 'every_12_hours'
  | 'as_needed'
  | 'other'

export type MedicationType = 'prescribed' | 'otc'

export interface Medication {
  id: string
  person_id: string
  family_id: string
  medication_name: string
  dosage: string | null
  frequency: MedicationFrequency
  frequency_notes: string | null
  med_type: MedicationType
  prescriber: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  discontinued_at: string | null
  notes: string | null
  created_by: string | null
  logged_at: string
  created_at: string
  person?: Person
}

export interface MedicationWithPerson extends Medication {
  person: Person
}

export interface MedicationDose {
  id: string
  medication_id: string
  family_id: string
  taken_at: string
  notes: string | null
  created_by: string | null
  logged_at: string
  created_at: string
}

export const FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  once_daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_daily: '3 times daily',
  four_daily: '4 times daily',
  every_8_hours: 'Every 8 hours',
  every_12_hours: 'Every 12 hours',
  as_needed: 'As needed',
  other: 'Other',
}

export const MED_TYPE_LABELS: Record<MedicationType, string> = {
  prescribed: 'Prescribed',
  otc: 'Over the counter',
}
