'use client'

import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, Plus, Users, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Recipient = { id: string; full_name: string; date_of_birth: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; created_at: string }

export default function CareDashboardPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/care/recipients')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load care profiles')
      setRecipients(data.recipients ?? [])
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not load care profiles') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setMessage('')
    try {
      const res = await fetch('/api/care/recipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name, date_of_birth: dob || null, emergency_contact_name: contactName || null, emergency_contact_phone: contactPhone || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create profile')
      setRecipients(current => [data.recipient, ...current]); setName(''); setDob(''); setContactName(''); setContactPhone(''); setMessage('Care profile created.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not create profile') }
    finally { setSaving(false) }
  }

  return <div className="mx-auto w-full max-w-5xl space-y-6 p-5 md:p-8">
    <header className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><HeartPulse className="h-6 w-6" /></div><div><h1 className="text-2xl font-semibold">Care tracking</h1><p className="mt-1 text-sm text-muted-foreground">Manage care profiles and prepare to track readings and medicines.</p></div></header>
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/><p>CareDesk is not an emergency service and does not provide medical advice. In an emergency in India, call 112.</p></div>
    <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-medium">Add a care profile</h2><form onSubmit={createRecipient} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Full name *<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm">Date of birth<input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="rounded-lg border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm">Local contact name<input maxLength={120} value={contactName} onChange={e=>setContactName(e.target.value)} className="rounded-lg border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm">Local contact phone<input maxLength={40} type="tel" value={contactPhone} onChange={e=>setContactPhone(e.target.value)} className="rounded-lg border bg-background px-3 py-2" /></label>
      <div className="sm:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4"/>{saving ? 'Saving…' : 'Create profile'}</Button></div>
    </form>{message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}</section>
    <section className="space-y-3"><h2 className="text-lg font-medium">Your care profiles</h2>{loading ? <p className="text-sm text-muted-foreground">Loading profiles…</p> : recipients.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No care profiles yet</p><p className="mt-1 text-sm text-muted-foreground">Add a profile to begin setting up care tracking.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{recipients.map(r=><article key={r.id} className="rounded-xl border p-4"><h3 className="font-medium">{r.full_name}</h3>{r.date_of_birth && <p className="mt-1 text-sm text-muted-foreground">Date of birth: {r.date_of_birth}</p>}{r.emergency_contact_name && <p className="mt-2 text-sm">Local contact: {r.emergency_contact_name}{r.emergency_contact_phone ? ' · '+r.emergency_contact_phone : ''}</p>}<p className="mt-3 text-xs text-muted-foreground">Vitals, consent, medicines, and alerts are not enabled for this profile yet.</p></article>)}</div>}</section>
  </div>
}
