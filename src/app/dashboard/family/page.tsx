'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, Check, X, Trash2, Loader2, Mail, Bell, Copy, Ticket } from 'lucide-react'

interface FamilyMember {
  id: string
  owner_id: string
  member_id: string
  relation: string | null
  status: string
  created_at: string
  display_name?: string
}

interface Invite {
  id: string
  email: string
  relation: string | null
  token: string
  status: string
  created_at: string
}

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

export default function FamilyPage() {
  const { user } = useUser()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRelation, setInviteRelation] = useState('')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')
  const [acceptCode, setAcceptCode] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const [membersRes, invitesRes, notifRes] = await Promise.all([
        fetch('/api/family/members'),
        fetch('/api/family/invites'),
        fetch('/api/notifications'),
      ])
      const membersData = await membersRes.json()
      const invitesData = await invitesRes.json()
      const notifData = await notifRes.json()
      setMembers(membersData.members || [])
      setInvites(invitesData.invites || [])
      // Only unread notifications are shown; read ones are dismissed.
      setNotifications((notifData.notifications || []).filter((n: Notification) => !n.read_at))
    } catch {
      console.error('Failed to fetch family data')
    }
    if (showSpinner) setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setMessage('')
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, relation: inviteRelation || undefined }),
      })
      const data = await res.json()
      if (data.ok) {
        setInviteEmail('')
        setInviteRelation('')
        setShowInvite(false)
        setMessage('Invite created. Share the invite code with your family member — they paste it below on their own Family page.')
        fetchData(false)
      } else {
        setMessage(data.error || 'Invite failed')
      }
    } catch {
      setMessage('Invite failed')
    }
    setInviting(false)
  }

  async function handleAcceptCode() {
    if (!acceptCode.trim()) return
    setAccepting(true)
    setMessage('')
    try {
      const res = await fetch('/api/family/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: acceptCode.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setAcceptCode('')
        setMessage('Invite accepted! Waiting for the owner to confirm the link.')
        fetchData(false)
      } else {
        setMessage(data.error || 'Could not accept invite')
      }
    } catch {
      setMessage('Could not accept invite')
    }
    setAccepting(false)
  }

  async function handleConfirm(memberId: string) {
    setMessage('')
    try {
      const res = await fetch('/api/family/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage('Family member confirmed — shared analytics are now active.')
      } else {
        setMessage(data.error || 'Confirm failed')
      }
      fetchData()
    } catch {
      setMessage('Confirm failed')
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await fetch(`/api/family/member?memberId=${memberId}`, { method: 'DELETE' })
      fetchData()
    } catch {
      console.error('Remove failed')
    }
  }

  async function handleCopyToken(inv: Invite) {
    try {
      await navigator.clipboard.writeText(inv.token)
      setCopiedId(inv.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      console.error('Copy failed')
    }
  }

  async function handleMarkRead(id: string) {
    // Dismiss immediately; the server write is fire-and-forget.
    setNotifications(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const acceptedMembers = members.filter(m => m.status === 'accepted')
  const pendingMembers = members.filter(m => m.status === 'pending_owner')
  const unread = notifications.filter(n => !n.read_at)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Family</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite family members and share health insights.
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="mr-2 size-4" />
          Invite Member
        </Button>
      </div>

      {message && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      )}

      {showInvite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Invite Family Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={inviteRelation}
                onChange={(e) => setInviteRelation(e.target.value)}
                placeholder="Relation (optional)"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-48"
              />
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                Send Invite
              </Button>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Bell className="size-4" /> Notifications
                {unread.length > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    {unread.length} new
                  </span>
                )}
              </h2>
              <div className="space-y-2">
                {notifications.slice(0, 8).map((n) => (
                  <Card key={n.id} className={n.read_at ? 'opacity-60' : ''}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.read_at && (
                        <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
                          <Check className="mr-1 size-3" /> Read
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Accept an invite code */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Ticket className="size-4" /> Have an invite code?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={acceptCode}
                  onChange={(e) => setAcceptCode(e.target.value)}
                  placeholder="Paste the invite code a family member shared with you"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button onClick={handleAcceptCode} disabled={accepting || !acceptCode.trim()}>
                  {accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                  Accept Invite
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Accepted Members */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Family Members</h2>
            {acceptedMembers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="size-10 text-muted-foreground/50" />
                  <h3 className="mt-3 font-medium">No family members yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invite family to share analytics and get health notifications.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {acceptedMembers.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Check className="size-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">
                            {m.display_name || m.relation || 'Family member'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.relation ? `${m.relation} · ` : ''}Linked {new Date(m.created_at).toLocaleDateString()} · shared analytics active
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Pending Members (owner confirms; member waits) */}
          {pendingMembers.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pending Confirmation</h2>
              <div className="space-y-2">
                {pendingMembers.map((m) => {
                  const iAmOwner = m.owner_id === user?.id
                  return (
                    <Card key={m.id}>
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Users className="size-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium">{m.relation || 'Family member'}</p>
                            <p className="text-xs text-muted-foreground">
                              {iAmOwner
                                ? 'Waiting for your confirmation'
                                : 'Waiting for the inviter to confirm your request'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {iAmOwner && (
                            <Button size="sm" onClick={() => handleConfirm(m.id)}>
                              <Check className="mr-1 size-3" /> Confirm
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pending Invites</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.relation ? `${inv.relation} · ` : ''}Invited {new Date(inv.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleCopyToken(inv)}>
                        <Copy className="mr-1 size-3" />
                        {copiedId === inv.id ? 'Copied!' : 'Copy invite code'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
