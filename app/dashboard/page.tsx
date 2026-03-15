import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DashboardTabs from '@/components/DashboardTabs'
import NotificationSettings from '@/components/NotificationSettings'
import SymptomForm from '@/components/SymptomForm'
import SymptomList from '@/components/SymptomList'
import QuickDoseBar from '@/components/QuickDoseBar'
import MedicationForm from '@/components/MedicationForm'
import MedicationList from '@/components/MedicationList'
import type { Person, SymptomEntryWithPerson, MedicationWithPerson, MedicationDose } from '@/lib/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const activeTab = params.tab === 'medications' ? 'medications' : 'symptoms'

  const supabase = await createClient()
  const admin = createAdminClient()

  // Auth check — getUser() works even though PostgREST queries don't
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Use admin client for ALL data reads (bypasses RLS).
  // The normal @supabase/ssr client's PostgREST queries fail because
  // auth.uid() returns null without working middleware session refresh.

  // Check if user already has a family
  let { data: member } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  // First-time setup
  if (!member) {
    const displayName = user.email?.split('@')[0] ?? 'User'

    const { data: family, error: familyError } = await admin
      .from('families')
      .insert({ name: 'My Family' })
      .select()
      .single()

    if (familyError || !family) {
      console.error('Failed to create family:', familyError)
      return (
        <div className="p-6 text-center">
          <p className="text-red-600">
            Failed to set up your account ({familyError?.message ?? 'unknown error'}).
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please sign out and sign back in, then try again.
          </p>
        </div>
      )
    }

    await admin.from('family_members').insert({
      family_id: family.id,
      user_id: user.id,
      role: 'admin',
    })

    await admin.from('people').insert({
      family_id: family.id,
      user_id: user.id,
      display_name: displayName,
    })

    member = { family_id: family.id, role: 'admin' }
  }

  const familyId = member.family_id

  // Load people in this family (shared across both tabs)
  const { data: people } = await admin
    .from('people')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  // Find the person record for the logged-in user (their default selection)
  const myPerson = (people ?? []).find((p: Person) => p.user_id === user.id)

  // Load data for the active tab
  let entries: SymptomEntryWithPerson[] = []
  let uniqueSymptoms: string[] = []
  let medications: MedicationWithPerson[] = []
  let recentDoses: MedicationDose[] = []
  let uniqueMedNames: string[] = []

  if (activeTab === 'symptoms') {
    // Load recent symptom entries (last 50) with person info
    const { data: symptomData } = await admin
      .from('symptom_entries')
      .select('*, person:people(id, display_name, family_id, user_id, created_at)')
      .eq('family_id', familyId)
      .order('logged_at', { ascending: false })
      .limit(50)

    entries = (symptomData ?? []) as SymptomEntryWithPerson[]

    // Load past symptom names for autocomplete
    const { data: pastSymptoms } = await admin
      .from('symptom_entries')
      .select('symptom_name')
      .eq('family_id', familyId)
      .order('logged_at', { ascending: false })
      .limit(200)

    uniqueSymptoms = [
      ...new Set((pastSymptoms ?? []).map((s) => s.symptom_name)),
    ]
  } else {
    // Load medications with person info
    const { data: medData } = await admin
      .from('medications')
      .select('*, person:people(id, display_name, family_id, user_id, created_at)')
      .eq('family_id', familyId)
      .order('logged_at', { ascending: false })
      .limit(50)

    medications = (medData ?? []) as MedicationWithPerson[]

    // Load recent doses
    const { data: doseData } = await admin
      .from('medication_doses')
      .select('*')
      .eq('family_id', familyId)
      .order('taken_at', { ascending: false })
      .limit(100)

    recentDoses = (doseData ?? []) as MedicationDose[]

    // Load past medication names for autocomplete
    const { data: pastMeds } = await admin
      .from('medications')
      .select('medication_name')
      .eq('family_id', familyId)
      .order('logged_at', { ascending: false })
      .limit(200)

    uniqueMedNames = [
      ...new Set((pastMeds ?? []).map((m) => m.medication_name)),
    ]
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-12">
      <NotificationSettings />
      <DashboardTabs activeTab={activeTab} />

      {activeTab === 'symptoms' ? (
        <>
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
              entries={entries}
              people={(people ?? []) as Person[]}
            />
          </div>
        </>
      ) : (
        <>
          <QuickDoseBar
            people={(people ?? []) as Person[]}
            defaultPersonId={myPerson?.id ?? people?.[0]?.id ?? ''}
            medications={medications}
            pastMedications={uniqueMedNames}
          />

          <details className="mt-4">
            <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              + Add a medication course
            </summary>
            <div className="mt-2">
              <MedicationForm
                people={(people ?? []) as Person[]}
                defaultPersonId={myPerson?.id ?? people?.[0]?.id ?? ''}
                pastMedications={uniqueMedNames}
              />
            </div>
          </details>

          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Medications
            </h2>
            <MedicationList
              medications={medications}
              doses={recentDoses}
              people={(people ?? []) as Person[]}
            />
          </div>
        </>
      )}
    </div>
  )
}
