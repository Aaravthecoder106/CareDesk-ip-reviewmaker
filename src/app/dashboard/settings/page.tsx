'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Lock, Unlock, Loader2, Trash2 } from 'lucide-react'

export default function SettingsPage() {
  const [hasPassword, setHasPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkPassword()
  }, [])

  async function checkPassword() {
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      setHasPassword(!!data.locked)
    } catch {
      console.error('Failed to check password')
    }
    setLoading(false)
  }

  async function handleSetPassword() {
    if (!password.trim()) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', password }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage('Password set successfully')
        setPassword('')
        setHasPassword(true)
      } else {
        setMessage(data.error || 'Failed to set password')
      }
    } catch {
      setMessage('Failed to set password')
    }
    setActionLoading(false)
  }

  async function handleRemovePassword() {
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage('Password removed')
        setHasPassword(false)
      }
    } catch {
      setMessage('Failed to remove password')
    }
    setActionLoading(false)
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Library Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {hasPassword ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              <CardTitle className="text-sm font-medium">Report Library Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasPassword ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Your report library is password-protected.
                </p>
                <Button variant="destructive" size="sm" onClick={handleRemovePassword} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Trash2 className="mr-2 size-3" />}
                  Remove Password
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set a password for your report library"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button onClick={handleSetPassword} disabled={actionLoading || !password.trim()}>
                  {actionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Shield className="mr-2 size-4" />}
                  Set Password
                </Button>
              </div>
            )}
            {message && (
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account settings are managed through your Clerk profile. Use the
              user menu in the sidebar to manage your account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
