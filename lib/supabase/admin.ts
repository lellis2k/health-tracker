import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Server-only admin client using the service_role key.
// Bypasses RLS — use only for trusted server-side operations.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey
  )
}
