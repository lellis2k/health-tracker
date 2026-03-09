'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Called once on first login to create family + person + family_member records
export async function initializeUserFamily(userId: string, email: string) {
  const supabase = await createClient()

  // Check again inside the action to avoid race conditions
  const { data: existing } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return { familyId: null } // already initialized

  // Create family
  const displayName = email.split('@')[0]
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ name: 'My Family' })
    .select()
    .single()

  if (familyError || !family) {
    console.error('Failed to create family:', familyError)
    return { error: familyError?.message }
  }

  // Create person record for this user
  const { error: personError } = await supabase.from('people').insert({
    family_id: family.id,
    user_id: userId,
    display_name: displayName,
  })

  if (personError) {
    console.error('Failed to create person:', personError)
    return { error: personError.message }
  }

  // Create family_member record
  const { error: memberError } = await supabase.from('family_members').insert({
    family_id: family.id,
    user_id: userId,
    role: 'admin',
  })

  if (memberError) {
    console.error('Failed to create family_member:', memberError)
    return { error: memberError.message }
  }

  return { familyId: family.id }
}

export async function addSymptomEntry(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const personId = formData.get('person_id') as string
  const symptomName = (formData.get('symptom_name') as string).trim()
  const severity = parseInt(formData.get('severity') as string, 10)
  const notes = (formData.get('notes') as string).trim() || null
  const loggedAt = formData.get('logged_at') as string

  if (!personId || !symptomName || isNaN(severity)) {
    return { error: 'Missing required fields' }
  }

  // Get family_id from person
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('family_id')
    .eq('id', personId)
    .single()

  if (personError || !person) {
    return { error: 'Person not found' }
  }

  const { error } = await supabase.from('symptom_entries').insert({
    person_id: personId,
    family_id: person.family_id,
    symptom_name: symptomName,
    severity,
    notes,
    logged_at: loggedAt || new Date().toISOString(),
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteSymptomEntry(entryId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('symptom_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function addPerson(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const displayName = (formData.get('display_name') as string).trim()
  const familyId = formData.get('family_id') as string

  if (!displayName || !familyId) {
    return { error: 'Display name is required' }
  }

  const { error } = await supabase.from('people').insert({
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
  const supabase = await createClient()

  const { error } = await supabase
    .from('families')
    .update({ name: name.trim() })
    .eq('id', familyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/family')
  return { success: true }
}

export async function updatePersonName(personId: string, displayName: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('people')
    .update({ display_name: displayName.trim() })
    .eq('id', personId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/family')
  revalidatePath('/dashboard')
  return { success: true }
}
