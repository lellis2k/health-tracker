'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Role = 'admin' | 'member'

// Helper: get authenticated user
async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return user
}

async function getFamilyRole(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  familyId: string
) {
  const { data, error } = await admin
    .from('family_members')
    .select('role')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .maybeSingle()

  if (error) {
    return { role: null as Role | null, error: error.message }
  }

  return { role: (data?.role as Role | undefined) ?? null, error: null }
}

export async function addSymptomEntry(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const personId = String(formData.get('person_id') ?? '')
  const symptomName = String(formData.get('symptom_name') ?? '').trim()
  const severity = parseInt(String(formData.get('severity') ?? ''), 10)
  const notes = String(formData.get('notes') ?? '').trim() || null
  const onsetDate = String(formData.get('onset_date') ?? '').trim() || null
  const endedOn = String(formData.get('ended_on') ?? '').trim() || null

  if (!personId || !symptomName || isNaN(severity) || severity < 1 || severity > 5) {
    return { error: 'Missing required fields' }
  }

  // Get family_id from person
  const { data: person, error: personError } = await admin
    .from('people')
    .select('family_id')
    .eq('id', personId)
    .single()

  if (personError || !person) {
    return { error: 'Person not found' }
  }

  const { role, error: roleError } = await getFamilyRole(
    admin,
    user.id,
    person.family_id
  )
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin.from('symptom_entries').insert({
    person_id: personId,
    family_id: person.family_id,
    symptom_name: symptomName,
    severity,
    notes,
    logged_at: new Date().toISOString(),
    created_by: user.id,
    onset_date: onsetDate,
    is_resolved: !!endedOn,
    // Noon UTC keeps the date correct across all UTC±12 timezones
    resolved_at: endedOn ? endedOn + 'T12:00:00.000Z' : null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteSymptomEntry(entryId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: entry, error: entryError } = await admin
    .from('symptom_entries')
    .select('family_id')
    .eq('id', entryId)
    .maybeSingle()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const { role, error: roleError } = await getFamilyRole(
    admin,
    user.id,
    entry.family_id
  )
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('symptom_entries')
    .delete()
    .eq('id', entryId)
    .eq('family_id', entry.family_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function resolveSymptomEntry(entryId: string, resolvedDate: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: entry, error: entryError } = await admin
    .from('symptom_entries')
    .select('family_id')
    .eq('id', entryId)
    .maybeSingle()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const { role, error: roleError } = await getFamilyRole(
    admin,
    user.id,
    entry.family_id
  )
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('symptom_entries')
    .update({ is_resolved: true, resolved_at: resolvedDate + 'T12:00:00.000Z' })
    .eq('id', entryId)
    .eq('family_id', entry.family_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateSymptomEntry(entryId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: entry, error: entryError } = await admin
    .from('symptom_entries')
    .select('family_id')
    .eq('id', entryId)
    .maybeSingle()

  if (entryError || !entry) return { error: 'Entry not found' }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, entry.family_id)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const symptomName = String(formData.get('symptom_name') ?? '').trim()
  const severity = parseInt(String(formData.get('severity') ?? ''), 10)
  const notes = String(formData.get('notes') ?? '').trim() || null
  const onsetDate = String(formData.get('onset_date') ?? '').trim() || null
  const endedOn = String(formData.get('ended_on') ?? '').trim() || null

  if (!symptomName || isNaN(severity) || severity < 1 || severity > 5) {
    return { error: 'Missing required fields' }
  }

  const { error } = await admin
    .from('symptom_entries')
    .update({
      symptom_name: symptomName,
      severity,
      notes,
      onset_date: onsetDate,
      is_resolved: !!endedOn,
      resolved_at: endedOn ? endedOn + 'T12:00:00.000Z' : null,
    })
    .eq('id', entryId)
    .eq('family_id', entry.family_id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function addPerson(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const displayName = String(formData.get('display_name') ?? '').trim()
  const familyId = String(formData.get('family_id') ?? '')

  if (!displayName || !familyId) {
    return { error: 'Display name is required' }
  }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, familyId)
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin.from('people').insert({
    family_id: familyId,
    display_name: displayName,
    user_id: null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/family')
  return { success: true }
}

export async function updateFamilyName(familyId: string, name: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const trimmedName = name.trim()

  if (!trimmedName) {
    return { error: 'Family name is required' }
  }

  const { role, error: roleError } = await getFamilyRole(admin, user.id, familyId)
  if (roleError) return { error: roleError }
  if (role !== 'admin') return { error: 'Only admins can update family settings' }

  const { error } = await admin
    .from('families')
    .update({ name: trimmedName })
    .eq('id', familyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/family')
  return { success: true }
}

export async function updatePersonName(personId: string, displayName: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const trimmedName = displayName.trim()

  if (!trimmedName) {
    return { error: 'Display name is required' }
  }

  const { data: person, error: personError } = await admin
    .from('people')
    .select('family_id')
    .eq('id', personId)
    .maybeSingle()

  if (personError || !person) {
    return { error: 'Person not found' }
  }

  const { role, error: roleError } = await getFamilyRole(
    admin,
    user.id,
    person.family_id
  )
  if (roleError) return { error: roleError }
  if (!role) return { error: 'Unauthorized' }

  const { error } = await admin
    .from('people')
    .update({ display_name: trimmedName })
    .eq('id', personId)
    .eq('family_id', person.family_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/family')
  revalidatePath('/dashboard')
  return { success: true }
}
