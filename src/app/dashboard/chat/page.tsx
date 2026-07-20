'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send, Trash2, Loader2, ImagePlus, X } from 'lucide-react'

interface Message {
  id: string
  role: string
  content: string
  created_at: string
}

export default function ChatPage() {
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
      alert('Only image files can be attached in chat. Upload PDFs and reports in the Report Library.')
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

    const attached = image
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: attached ? `${input.trim()} [image attached]`.trim() : input.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setImage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim() || 'Please analyze this image.',
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          image: attached ? { data: attached.data, mimeType: attached.mimeType } : undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          created_at: new Date().toISOString(),
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  async function handleClear() {
    await fetch('/api/chat/clear', { method: 'DELETE' })
    setMessages([])
  }

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions about your medical reports and health data.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="mr-2 size-4" />
            Clear
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
                <h3 className="mt-4 font-medium">Start a conversation</h3>
                <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                  Upload reports first, then ask AI anything about your health data.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-4 py-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4">
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
                    aria-label="Remove image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">Image attached</span>
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
                title="Attach an image"
              >
                <ImagePlus className="size-4" />
              </Button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your health data..."
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
