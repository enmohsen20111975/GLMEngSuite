'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  User,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const suggestedPrompts = [
  "How do I calculate voltage drop in a cable?",
  "Explain the Reynolds number and its significance",
  "What's the formula for beam deflection?",
  "How to size a cable for a 3-phase motor?",
  "Explain power factor correction",
  "What are the IEC standards for cable sizing?",
]

export function AIAssistantSection() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sessionId] = React.useState(() => `session-${Date.now()}`)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (message?: string) => {
    const text = message || input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'I apologize, but I encountered an error. Please try again.' },
        ])
      }
    } catch (err) {
      console.error('AI chat error:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'I apologize, but I encountered a connection error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setMessages([])
    try {
      await fetch(`/api/ai?sessionId=${sessionId}`, { method: 'DELETE' })
    } catch {
      // Ignore
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-600" />
            AI Engineering Assistant
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ask any engineering question and get expert-level answers
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
            <Trash2 className="h-3 w-3" />
            Clear Chat
          </Button>
        )}
      </div>

      <Card className="flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: '400px' }}>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">EngiSuite AI Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  I can help you with engineering calculations, explain concepts, recommend parameters, 
                  and guide you through design standards.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      className="text-xs h-auto py-2 px-3 text-left justify-start"
                      onClick={() => handleSend(prompt)}
                    >
                      <Sparkles className="h-3 w-3 mr-2 shrink-0 text-emerald-500" />
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask an engineering question..."
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              AI responses are for guidance only. Always verify with applicable standards and codes.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
