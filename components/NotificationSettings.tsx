'use client'

import { useState, useEffect } from 'react'
import { subscribeToPush, unsubscribeFromPush, sendTestNotification } from '@/lib/push-actions'


type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export default function NotificationSettings() {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      })
    })
  }, [])

  async function handleSubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      setPermission(permission as PermissionState)

      if (permission !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })

      const result = await subscribeToPush(sub.toJSON())
      if (result.error) {
        console.error('Subscribe error:', result.error)
      } else {
        setSubscribed(true)
      }
    } catch (e) {
      console.error('Subscription failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleUnsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribeFromPush(sub.endpoint)
        await sub.unsubscribe()
        setSubscribed(false)
      }
    } catch (e) {
      console.error('Unsubscribe failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTestStatus(null)
    const result = await sendTestNotification()
    setTestStatus(result.error ?? 'Sent!')
    setTimeout(() => setTestStatus(null), 4000)
  }

  if (permission === 'unsupported') return null

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Notifications</h3>

      {permission === 'denied' && (
        <p className="text-sm text-red-600">
          Notifications blocked. Enable them in your browser settings.
        </p>
      )}

      {permission !== 'denied' && !subscribed && (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}

      {subscribed && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-700">Notifications enabled</span>
          <button
            onClick={handleTest}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Send test
          </button>
          <button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            Disable
          </button>
          {testStatus && (
            <span className={`text-sm ${testStatus === 'Sent!' ? 'text-green-600' : 'text-red-600'}`}>
              {testStatus}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
