'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, getFamilyRole } from '@/lib/action-helpers'

export async function addMedication(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const personId = String(formData.get('person_id') ?? '')
  const medicationName = String(formData.get('medication_name') ?? '').trim()
  const dosage = String(formData.get('dosage') ?? '').trim() || null
  const frequency = String(formData.get('frequency') ?? 'as_needed')
  const frequencyNotes = String(formData.get('frequency_notes') ?? '').trim() || null
  const medType = String(formData.get('med_type') ?? 'otc')
  const prescriber = String(formData.get('prescriber') ?? '').trim() || null
  const startDate = String(formData.get('start_date') ?? '').trim() || null
  const endDate = String(formData.get('end_date') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!personId || !medicationName) {
    return { error: 'Medication name is required' }
  }

  const { data: person, error: personError } = await admin
    .from('people')
    .select('family_id')
    .eq('id', personId)
    .single()

  if (personError || !person) return { error: 'Person not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, person.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin.from('medications').insert({
    person_id: personId,
    family_id: person.family_id,
    medication_name: medicationName,
    dosage,
    frequency,
    frequency_notes: frequencyNotes,
    med_type: medType,
    prescriber,
    start_date: startDate,
    end_date: endDate,
    notes,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateMedication(medicationId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: med, error: medError } = await admin
    .from('medications')
    .select('family_id')
    .eq('id', medicationId)
    .maybeSingle()

  if (medError || !med) return { error: 'Medication not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, med.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const medicationName = String(formData.get('medication_name') ?? '').trim()
  const dosage = String(formData.get('dosage') ?? '').trim() || null
  const frequency = String(formData.get('frequency') ?? 'as_needed')
  const frequencyNotes = String(formData.get('frequency_notes') ?? '').trim() || null
  const medType = String(formData.get('med_type') ?? 'otc')
  const prescriber = String(formData.get('prescriber') ?? '').trim() || null
  const startDate = String(formData.get('start_date') ?? '').trim() || null
  const endDate = String(formData.get('end_date') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!medicationName) return { error: 'Medication name is required' }

  const { error } = await admin
    .from('medications')
    .update({
      medication_name: medicationName,
      dosage,
      frequency,
      frequency_notes: frequencyNotes,
      med_type: medType,
      prescriber,
      start_date: startDate,
      end_date: endDate,
      notes,
    })
    .eq('id', medicationId)
    .eq('family_id', med.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteMedication(medicationId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: med, error: medError } = await admin
    .from('medications')
    .select('family_id')
    .eq('id', medicationId)
    .maybeSingle()

  if (medError || !med) return { error: 'Medication not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, med.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('medications')
    .delete()
    .eq('id', medicationId)
    .eq('family_id', med.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function discontinueMedication(medicationId: string, discontinuedDate: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: med, error: medError } = await admin
    .from('medications')
    .select('family_id')
    .eq('id', medicationId)
    .maybeSingle()

  if (medError || !med) return { error: 'Medication not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, med.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('medications')
    .update({
      is_active: false,
      discontinued_at: discontinuedDate + 'T12:00:00.000Z',
    })
    .eq('id', medicationId)
    .eq('family_id', med.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function reactivateMedication(medicationId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: med, error: medError } = await admin
    .from('medications')
    .select('family_id')
    .eq('id', medicationId)
    .maybeSingle()

  if (medError || !med) return { error: 'Medication not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, med.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('medications')
    .update({ is_active: true, discontinued_at: null })
    .eq('id', medicationId)
    .eq('family_id', med.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function logDose(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const medicationId = String(formData.get('medication_id') ?? '')
  const takenAt = String(formData.get('taken_at') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!medicationId || !takenAt) return { error: 'Missing required fields' }

  const { data: med, error: medError } = await admin
    .from('medications')
    .select('family_id')
    .eq('id', medicationId)
    .maybeSingle()

  if (medError || !med) return { error: 'Medication not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, med.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin.from('medication_doses').insert({
    medication_id: medicationId,
    family_id: med.family_id,
    taken_at: takenAt,
    notes,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function quickLogDose(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const personId = String(formData.get('person_id') ?? '')
  const medicationName = String(formData.get('medication_name') ?? '').trim()
  const dosage = String(formData.get('dosage') ?? '').trim() || null
  const existingMedicationId = String(formData.get('existing_medication_id') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const takenAtRaw = String(formData.get('taken_at') ?? '').trim()
  // takenAtRaw is a local datetime string (YYYY-MM-DDTHH:MM); convert to ISO or fall back to now
  const takenAt = takenAtRaw ? new Date(takenAtRaw).toISOString() : new Date().toISOString()

  if (!personId || !medicationName) {
    return { error: 'Medication name is required' }
  }

  // Look up person to get family_id
  const { data: person, error: personError } = await admin
    .from('people')
    .select('family_id')
    .eq('id', personId)
    .single()

  if (personError || !person) return { error: 'Person not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, person.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  let medicationId: string

  if (existingMedicationId) {
    // Verify the existing medication belongs to this family and is active
    const { data: med, error: medError } = await admin
      .from('medications')
      .select('id, is_active')
      .eq('id', existingMedicationId)
      .eq('family_id', person.family_id)
      .maybeSingle()

    if (medError || !med) return { error: 'Medication not found' }
    if (!med.is_active) return { error: 'Medication is discontinued' }
    medicationId = med.id
  } else {
    // Find or create: look for active medication with this name for this person
    const { data: matches, error: matchError } = await admin
      .from('medications')
      .select('id, medication_name, dosage')
      .eq('person_id', personId)
      .eq('family_id', person.family_id)
      .eq('is_active', true)
      .ilike('medication_name', medicationName)

    if (matchError) return { error: matchError.message }

    if (matches && matches.length === 1) {
      // Exactly one match — use it
      medicationId = matches[0].id
    } else if (matches && matches.length > 1) {
      // Multiple matches — return them for client disambiguation
      return {
        error: 'multiple_matches',
        matches: matches.map((m) => ({
          id: m.id,
          medication_name: m.medication_name,
          dosage: m.dosage,
        })),
      }
    } else {
      // No match — create a new medication with OTC defaults
      const today = new Date()
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const { data: newMed, error: createError } = await admin
        .from('medications')
        .insert({
          person_id: personId,
          family_id: person.family_id,
          medication_name: medicationName,
          dosage,
          frequency: 'as_needed',
          med_type: 'otc',
          start_date: startDate,
          is_active: true,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (createError || !newMed) return { error: createError?.message ?? 'Failed to create medication' }
      medicationId = newMed.id
    }
  }

  // Log the dose
  const { error: doseError } = await admin.from('medication_doses').insert({
    medication_id: medicationId,
    family_id: person.family_id,
    taken_at: takenAt,
    notes,
    created_by: user.id,
  })

  if (doseError) return { error: doseError.message }

  revalidatePath('/dashboard')
  return { success: true, medicationId, medicationName }
}

export async function deleteDose(doseId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: dose, error: doseError } = await admin
    .from('medication_doses')
    .select('family_id')
    .eq('id', doseId)
    .maybeSingle()

  if (doseError || !dose) return { error: 'Dose not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, dose.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('medication_doses')
    .delete()
    .eq('id', doseId)
    .eq('family_id', dose.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
