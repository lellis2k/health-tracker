import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FamilyManager from '@/components/FamilyManager'
import type { Family, Person } from '@/lib/types'

export default async function FamilyPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: member } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) {
    redirect('/dashboard')
  }

  const { data: family } = await admin
    .from('families')
    .select('*')
    .eq('id', member.family_id)
    .single()

  if (!family) {
    redirect('/dashboard')
  }

  const { data: people } = await admin
    .from('people')
    .select('*')
    .eq('family_id', member.family_id)
    .order('created_at', { ascending: true })

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <FamilyManager
        family={family as Family}
        people={(people ?? []) as Person[]}
        isAdmin={member.role === 'admin'}
        currentUserId={user.id}
      />
    </div>
  )
}
