import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { initializeUserFamily } from '@/lib/data-actions'
import SymptomForm from '@/components/SymptomForm'
import SymptomList from '@/components/SymptomList'
import type { Person, SymptomEntryWithPerson } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user has a family; create one if not
  const { data: memberRecord } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberRecord) {
    await initializeUserFamily(user.id, user.email ?? 'user')
  }

  // Re-fetch after potential init
  const { data: member } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to set up your account. Please refresh the page.
      </div>
    )
  }

  const familyId = member.family_id

  // Load people in this family
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  // Load recent symptom entries (last 50) with person info
  const { data: entries } = await supabase
    .from('symptom_entries')
    .select('*, person:people(id, display_name, family_id, user_id, created_at)')
    .eq('family_id', familyId)
    .order('logged_at', { ascending: false })
    .limit(50)

  // Load past symptom names for autocomplete
  const { data: pastSymptoms } = await supabase
    .from('symptom_entries')
    .select('symptom_name')
    .eq('family_id', familyId)
    .order('logged_at', { ascending: false })
    .limit(200)

  const uniqueSymptoms = [
    ...new Set((pastSymptoms ?? []).map((s) => s.symptom_name)),
  ]

  // Find the person record for the logged-in user (their default selection)
  const myPerson = (people ?? []).find((p: Person) => p.user_id === user.id)

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-12">
      <SymptomForm
        people={(people ?? []) as Person[]}
        defaultPersonId={myPerson?.id ?? people?.[0]?.id ?? ''}
        pastSymptoms={uniqueSymptoms}
      />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Recent entries
        </h2>
        <SymptomList
          entries={(entries ?? []) as SymptomEntryWithPerson[]}
          people={(people ?? []) as Person[]}
        />
      </div>
    </div>
  )
}
