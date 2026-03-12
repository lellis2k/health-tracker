'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type Role = 'admin' | 'member'

export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return user
}

export async function getFamilyRole(
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
