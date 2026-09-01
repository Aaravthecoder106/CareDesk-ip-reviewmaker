'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/components/clerk-shim'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
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
  const { t } = useLanguage()
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
    const sentTo = inviteEmail.trim()
    setInviting(true)
    setMessage('')
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentTo, relation: inviteRelation || undefined }),
      })
      const data = await res.json()
      if (data.ok) {
        setInviteEmail('')
        setInviteRelation('')
        setShowInvite(false)
        if (data.emailSent) {
          setMessage(t('family.messages.sent', { email: sentTo }))
        } else {
          setMessage(t('family.messages.emailFailed', { email: sentTo }))
        }
        fetchData(false)
      } else {
        setMessage(data.error || t('family.messages.failed'))
      }
    } catch {
      setMessage(t('family.messages.failed'))
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
        setMessage(t('family.messages.accepted'))
        fetchData(false)
      } else {
        setMessage(data.error || t('family.messages.acceptFailed'))
      }
    } catch {
      setMessage(t('family.messages.acceptFailed'))
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
        setMessage(t('family.messages.confirmed'))
      } else {
        setMessage(data.error || t('family.messages.confirmFailed'))
      }
      fetchData()
    } catch {
      setMessage(t('family.messages.confirmFailed'))
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
    <div className="p-4 sm:p-5 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] sm:text-[24px] leading-[30px] sm:leading-[32px] font-semibold text-on-surface">{t('family.title')}</h1>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            {t('family.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="btn-primary-gradient w-full sm:w-auto">
          <UserPlus className="mr-2 size-4" />
          {t('family.inviteMember')}
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-4 glass-panel rounded-xl p-4 border border-secondary/20">
          <p className="text-[14px] text-on-surface">{message}</p>
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div className="mb-5 sm:mb-6 glass-panel organic-radius p-4 sm:p-5">
          <h3 className="text-[16px] font-semibold text-deep-navy mb-3">{t('family.inviteCard.title')}</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('family.inviteCard.emailPlaceholder')}
              className="flex-1 rounded-lg bg-white/50 border border-outline-variant/50 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            />
            <input
              value={inviteRelation}
              onChange={(e) => setInviteRelation(e.target.value)}
              placeholder={t('family.inviteCard.relationPlaceholder')}
              className="w-full rounded-lg bg-white/50 border border-outline-variant/50 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary sm:w-48"
            />
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="btn-primary-gradient">
              {inviting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
              {t('family.inviteCard.send')}
            </Button>
            <Button variant="ghost" onClick={() => setShowInvite(false)} className="hover:bg-surface-container">{t('family.inviteCard.cancel')}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <>
          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-on-surface-variant">
                <Bell className="size-4" /> {t('family.notifications')}
                {unread.length > 0 && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-white font-bold">
                    {t('family.notifications.new', { count: unread.length })}
                  </span>
                )}
              </h2>
              <div className="space-y-2">
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`glass-panel rounded-xl p-4 ${n.read_at ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-deep-navy">{n.title}</p>
                        {n.body && <p className="text-[12px] text-on-surface-variant">{n.body}</p>}
                        <p className="mt-0.5 text-[10px] text-on-surface-variant">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.read_at && (
                        <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)} className="self-start sm:self-auto hover:bg-surface-container">
                          <Check className="mr-1 size-3" /> {t('family.notifications.read')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accept Invite Code */}
          <div className="mb-5 sm:mb-6 glass-panel organic-radius p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-[16px] font-semibold text-deep-navy mb-3">
              <Ticket className="size-4 text-secondary" /> {t('family.acceptCode.title')}
            </h3>
            <div className="flex flex-col gap-2.5 sm:gap-3 sm:flex-row">
              <input
                value={acceptCode}
                onChange={(e) => setAcceptCode(e.target.value)}
                placeholder={t('family.acceptCode.placeholder')}
                className="flex-1 rounded-lg bg-white/50 border border-outline-variant/50 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              />
              <Button onClick={handleAcceptCode} disabled={accepting || !acceptCode.trim()} className="btn-primary-gradient">
                {accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                {t('family.acceptCode.accept')}
              </Button>
            </div>
          </div>

          {/* Accepted Members */}
          <div className="mb-6">
            <h2 className="mb-3 text-[14px] font-semibold text-on-surface-variant">{t('family.members.title')}</h2>
            {acceptedMembers.length === 0 ? (
              <div className="glass-panel organic-radius flex flex-col items-center justify-center py-12">
                <Users className="size-10 text-on-surface-variant/50" />
                <h3 className="mt-3 text-[16px] font-semibold text-deep-navy">{t('family.members.empty.title')}</h3>
                <p className="mt-1 text-[14px] text-on-surface-variant">
                  {t('family.members.empty.desc')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedMembers.map((m) => (
                  <div key={m.id} className="glass-panel rounded-xl p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                          <Check className="size-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-deep-navy">
                            {m.display_name || m.relation || t('family.members.defaultName')}
                          </p>
                          <p className="text-[12px] text-on-surface-variant">
                            {m.relation ? `${m.relation} · ` : ''}{t('family.members.linked', { date: new Date(m.created_at).toLocaleDateString() })}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m.id)} className="self-end sm:self-auto hover:bg-destructive/10">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Members */}
          {pendingMembers.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-[14px] font-semibold text-on-surface-variant">{t('family.pending.title')}</h2>
              <div className="space-y-2">
                {pendingMembers.map((m) => {
                  const iAmOwner = m.owner_id === user?.id
                  return (
                    <div key={m.id} className="glass-panel rounded-xl p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                            <Users className="size-4 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-deep-navy">{m.relation || t('family.members.defaultName')}</p>
                            <p className="text-[12px] text-on-surface-variant">
                              {iAmOwner
                                ? t('family.pending.waitingOwner')
                                : t('family.pending.waitingMember')}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                          {iAmOwner && (
                            <Button size="sm" onClick={() => handleConfirm(m.id)} className="btn-primary-gradient">
                              <Check className="mr-1 size-3" /> {t('family.pending.confirm')}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)} className="hover:bg-destructive/10">
                            <X className="size-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <h2 className="mb-3 text-[14px] font-semibold text-on-surface-variant">{t('family.invites.title')}</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="glass-panel rounded-xl p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                          <Mail className="size-4 text-on-surface-variant" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-deep-navy">{inv.email}</p>
                          <p className="text-[12px] text-on-surface-variant">
                            {inv.relation ? `${inv.relation} · ` : ''}{t('family.invites.invited', { date: new Date(inv.created_at).toLocaleDateString() })}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleCopyToken(inv)} className="w-full sm:w-auto border-outline-variant/50 hover:bg-surface-container">
                        <Copy className="mr-1 size-3" />
                        {copiedId === inv.id ? t('family.invites.copied') : t('family.invites.copyCode')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
