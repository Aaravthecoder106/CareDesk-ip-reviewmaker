'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, HeartPulse, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Recipient = {
  id: string
  full_name: string
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  created_at: string
}

export default function CareDashboardPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const refresh = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/care/recipients', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load care profiles.')
      setRecipients(Array.isArray(data.recipients) ? data.recipients : [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load care profiles.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/care/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          date_of_birth: dob || null,
          emergency_contact_name: contactName.trim() || null,
          emergency_contact_phone: contactPhone.trim() || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create this profile.')

      setRecipients((current) => [data.recipient as Recipient, ...current])
      setName('')
      setDob('')
      setContactName('')
      setContactPhone('')
      setMessage('Care profile created. Parent consent is needed before health readings can be displayed.')
      setMessageType('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create this profile.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Family Care Dashboard
      </Link>

      <header className="flex flex-col gap-4 border-b border-outline-variant/50 pb-6 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Family care setup</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-deep-navy sm:text-3xl">Care profiles</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Keep essential family care details together. Health readings stay hidden until the parent’s consent is active.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 sm:p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="font-semibold">A support tool, not an emergency service</p>
          <p className="mt-1">
            CareDesk organizes health information; it does not diagnose or replace a clinician. In an emergency in India, call 112.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-deep-navy">Add a parent or loved one</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Start with the basics. You can keep the local emergency contact alongside the profile.</p>
        </div>
        <form onSubmit={createRecipient} className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <label htmlFor="care-full-name" className="grid gap-1.5 text-sm font-medium text-deep-navy">
            Full name <span className="text-rose-700" aria-hidden="true">*</span>
            <input
              id="care-full-name"
              required
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="e.g. Rajesh Sharma"
            />
          </label>
          <label htmlFor="care-dob" className="grid gap-1.5 text-sm font-medium text-deep-navy">
            Date of birth
            <input
              id="care-dob"
              type="date"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              className="min-h-11 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <label htmlFor="care-contact-name" className="grid gap-1.5 text-sm font-medium text-deep-navy">
            Local emergency contact
            <input
              id="care-contact-name"
              maxLength={120}
              autoComplete="name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="min-h-11 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Name of someone nearby"
            />
          </label>
          <label htmlFor="care-contact-phone" className="grid gap-1.5 text-sm font-medium text-deep-navy">
            Contact phone number
            <input
              id="care-contact-phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              className="min-h-11 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="A local number"
            />
          </label>
          <div className="sm:col-span-2 flex flex-col gap-3 border-t border-outline-variant/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-5 text-on-surface-variant">
              Only add details you’re authorized to share. Consent, daily check-ins, and medication workflows will be enabled in later steps.
            </p>
            <Button type="submit" disabled={saving || !name.trim()} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving profile…' : 'Create care profile'}
            </Button>
          </div>
        </form>
        {message && (
          <div
            role={messageType === 'error' ? 'alert' : 'status'}
            className={'mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ' + (
              messageType === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            )}
          >
            {messageType === 'error'
              ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {message}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-deep-navy">Your care profiles</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Profiles you have set up for your family.</p>
          </div>
          <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
            {recipients.length} {recipients.length === 1 ? 'profile' : 'profiles'}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-outline-variant/50 bg-white" />)}
          </div>
        ) : recipients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-9 text-center">
            <Users className="mx-auto h-8 w-8 text-on-surface-variant" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-deep-navy">No care profiles yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-on-surface-variant">
              Add the first profile above. It will appear here and on your Family Care Dashboard.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recipients.map((recipient) => (
              <article key={recipient.id} className="rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <HeartPulse className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-deep-navy">{recipient.full_name}</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {recipient.date_of_birth ? 'Date of birth: ' + recipient.date_of_birth : 'Date of birth not added'}
                    </p>
                    {recipient.emergency_contact_name && (
                      <p className="mt-2 text-sm text-on-surface-variant">
                        Local contact: <span className="font-medium text-deep-navy">{recipient.emergency_contact_name}</span>
                        {recipient.emergency_contact_phone ? ' · ' + recipient.emergency_contact_phone : ''}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-4 border-t border-outline-variant/40 pt-3 text-xs leading-5 text-on-surface-variant">
                  Consent setup, vital logging, medication tracking, and alerts are not available yet.
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

