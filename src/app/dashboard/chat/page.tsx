'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { MessageSquare, Send, Trash2, Loader2, ImagePlus, X } from 'lucide-react'

interface Message {
  id: string
  role: string
  content: string
  created_at: string
}

export default function ChatPage() {
  const { t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/chat/history')
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      console.error('Failed to fetch history')
    }
    setHistoryLoading(false)
  }

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert(t('chat.imageOnly'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || ''
      setImage({ data: base64, mimeType: file.type, preview: result })
    }
    reader.readAsDataURL(file)
  }

  async function handleSend() {
    if ((!input.trim() && !image) || loading) return

    const userText = input.trim() || 'Please analyze this image.'
    const attached = image

    // Add user message immediately
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: attached ? `${userText} [image attached]` : userText,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setImage(null)
    setLoading(true)

    // Create a placeholder for the streaming assistant message
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      if (!attached) {
        // Streaming path — text-only message
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Chat failed' }))
          throw new Error(errData.error || 'Chat failed')
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let content = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          content += chunk
          // Update the assistant message with accumulated content
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content } : m,
            ),
          )
        }
      } else {
        // Non-streaming path — with image attachment
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            image: { data: attached.data, mimeType: attached.mimeType },
          }),
        })
        const data = await res.json()
        if (data.ok) {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: data.reply } : m,
            ),
          )
        } else {
          throw new Error(data.error || 'Chat failed')
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: err instanceof Error ? err.message : t('chat.error') }
            : m,
        ),
      )
    }
    setLoading(false)
  }

  async function handleClear() {
    await fetch('/api/chat/clear', { method: 'DELETE' })
    setMessages([])
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{t('chat.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('chat.subtitle')}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="self-start sm:self-auto">
            <Trash2 className="mr-2 size-4" />
            {t('chat.clear')}
          </Button>
        )}
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="size-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">{t('chat.empty.title')}</h3>
                <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                  {t('chat.empty.desc')}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[80%] sm:px-4 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content || (
                      msg.role === 'assistant' && loading && msg.id === messages[messages.length - 1]?.id ? (
                        <Loader2 className="inline size-4 animate-spin" />
                      ) : null
                    )}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3 sm:p-4">
            {image && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.preview}
                    alt="attachment preview"
                    className="size-16 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute -right-2 -top-2 rounded-full bg-background border p-0.5 shadow"
                    aria-label={t('chat.removeImage')}
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{t('chat.imageAttached')}</span>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickImage}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title={t('chat.attachImage')}
              >
                <ImagePlus className="size-4" />
              </Button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat.input.placeholder')}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
              <Button type="submit" size="icon" disabled={loading || (!input.trim() && !image)}>
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
