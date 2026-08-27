'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n/language-context'
import { MessageCircleHeart, X, Loader2, Send, Check } from 'lucide-react'

export function FeedbackWidget() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [wouldUse, setWouldUse] = useState<string | null>(null)
  const [liked, setLiked] = useState('')
  const [missing, setMissing] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const choiceLabels = ['Yes', 'No', 'Maybe']

  async function handleSend() {
    if (!wouldUse) {
      setError(t('feedback.answerRequired'))
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
        setError(data.error || t('feedback.error'))
      }
    } catch {
      setError(t('feedback.error'))
    }
    setSending(false)
  }

  function handleClose() {
    setOpen(false)
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
        <span className="hidden sm:inline text-base">{t('feedback.button')}</span>
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
              <CardTitle className="text-base">{t('feedback.title')}</CardTitle>
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
                  <p className="font-medium">{t('feedback.thanks')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('feedback.thanksDesc')}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    {t('feedback.close')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">{t('feedback.question1')}</p>
                    <div className="flex gap-2">
                      {choiceLabels.map((c) => (
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
                    <p className="mb-2 text-sm font-medium">{t('feedback.question2')}</p>
                    <textarea
                      value={liked}
                      onChange={(e) => setLiked(e.target.value)}
                      rows={3}
                      placeholder={t('feedback.question2.placeholder')}
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">{t('feedback.question3')}</p>
                    <textarea
                      value={missing}
                      onChange={(e) => setMissing(e.target.value)}
                      rows={3}
                      placeholder={t('feedback.question3.placeholder')}
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
                    {t('feedback.send')}
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
