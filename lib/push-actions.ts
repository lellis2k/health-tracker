'use server'

import 'server-only'
import webpush from 'web-push'
import { getAuthUser, getFamilyRole } from '@/lib/action-helpers'
import { createAdminClient } from '@/lib/supabase/admin'

// VAPID configuration — keys generated once with `npx web-push generate-vapid-keys`
// NEXT_PUBLIC_VAPID_PUBLIC_KEY  — safe to expose (public key by design)
// VAPID_PRIVATE_KEY             — server-only, never expose to the client
// VAPID_EMAIL                   — contact email for the push service
webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function subscribeToPush(subscription: PushSubscriptionJSON) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Get the user's family
  const { data: member } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { error: 'No family found' }

  const endpoint = subscription.endpoint
  const authKey = subscription.keys?.auth
  const p256dhKey = subscription.keys?.p256dh

  if (!endpoint || !authKey || !p256dhKey) return { error: 'Invalid subscription' }

  // Upsert — same device re-subscribing replaces old record
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      family_id: member.family_id,
      endpoint,
      auth_key: authKey,
      p256dh_key: p256dhKey,
    },
    { onConflict: 'endpoint' }
  )

  if (error) return { error: error.message }
  return { error: null }
}

export async function unsubscribeFromPush(endpoint: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return { error: error.message }
  return { error: null }
}

export async function sendTestNotification() {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Get all subscriptions for this user
  const { data: subs, error: fetchError } = await admin
    .from('push_subscriptions')
    .select('endpoint, auth_key, p256dh_key')
    .eq('user_id', user.id)

  if (fetchError) return { error: fetchError.message }
  if (!subs || subs.length === 0) return { error: 'No subscriptions found' }

  const payload = JSON.stringify({
    title: 'Health Tracker',
    body: 'Push notifications are working!',
  })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } },
        payload
      )
    )
  )

  // Clean up expired/invalid subscriptions (410 Gone)
  const staleEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410) {
        staleEndpoints.push(subs[i].endpoint)
      }
    }
  })

  if (staleEndpoints.length > 0) {
    await admin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
      .eq('user_id', user.id)
  }

  const failures = results.filter((r) => r.status === 'rejected').length
  if (failures === results.length) return { error: 'All notifications failed to send' }

  return { error: null }
}
