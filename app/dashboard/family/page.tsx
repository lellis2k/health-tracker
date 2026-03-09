import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FamilyManager from '@/components/FamilyManager'
import type { Family, Person } from '@/lib/types'

export default async function FamilyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: member } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    redirect('/dashboard')
  }

  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('id', member.family_id)
    .single()

  const { data: people } = await supabase
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
