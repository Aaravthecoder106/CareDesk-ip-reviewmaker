'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageCircleHeart, X, Loader2, Send, Check } from 'lucide-react'

const CHOICES = ['Yes', 'No', 'Maybe'] as const

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [wouldUse, setWouldUse] = useState<string | null>(null)
  const [liked, setLiked] = useState('')
  const [missing, setMissing] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!wouldUse) {
      setError('Please answer the first question')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wouldUse, liked, missing }),
      })
      const data = await res.json()
      if (data.ok) {
        setSent(true)
      } else {
        setError(data.error || 'Could not send feedback. Please try again.')
      }
    } catch {
      setError('Could not send feedback. Please try again.')
    }
    setSending(false)
  }

  function handleClose() {
    setOpen(false)
    // Reset after the closing animation would finish so reopening is fresh.
    if (sent) {
      setTimeout(() => {
        setSent(false)
        setWouldUse(null)
        setLiked('')
        setMissing('')
        setError('')
      }, 300)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed z-40 shadow-lg max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] max-sm:right-[max(1rem,env(safe-area-inset-right))] bottom-4 right-4 sm:bottom-6 sm:right-6"
      >
        <MessageCircleHeart className="size-7 sm:mr-2" />
        <span className="hidden sm:inline text-base">Feedback</span>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Share your feedback</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
                    <Check className="size-6 text-green-600" />
                  </div>
                  <p className="font-medium">Thank you!</p>
                  <p className="text-sm text-muted-foreground">
                    Your feedback has been sent.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Would you use this app?</p>
                    <div className="flex gap-2">
                      {CHOICES.map((c) => (
                        <Button
                          key={c}
                          type="button"
                          size="sm"
                          variant={wouldUse === c ? 'default' : 'outline'}
                          onClick={() => setWouldUse(c)}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">What did you like?</p>
                    <textarea
                      value={liked}
                      onChange={(e) => setLiked(e.target.value)}
                      rows={3}
                      placeholder="Tell us what worked well for you..."
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">What&apos;s missing?</p>
                    <textarea
                      value={missing}
                      onChange={(e) => setMissing(e.target.value)}
                      rows={3}
                      placeholder="What would make this app better?"
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button onClick={handleSend} disabled={sending}>
                    {sending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 size-4" />
                    )}
                    Send Feedback
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
