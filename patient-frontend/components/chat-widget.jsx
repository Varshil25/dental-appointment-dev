'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, X, Send, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BorderBeam } from '@/components/ui/border-beam';

const GREETING =
  "Hi! I can help answer questions about our clinic, dentists, or hours. For booking, rescheduling, or cancelling, I'll point you to the right page.";

const FALLBACK_ERROR =
  "Sorry, I'm having trouble responding right now — please try again in a moment, or use the booking/contact pages directly.";

function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <Avatar size="sm" className="mt-0.5 shrink-0 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Stethoscope className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground'
        )}
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <Avatar size="sm" className="mt-0.5 shrink-0 bg-primary/10">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Stethoscope className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

// Floating support chatbot — answers clinic/dentist/FAQ questions and
// points patients at /book or /book/manage for anything transactional. It
// never books/reschedules/cancels itself; it only talks. Conversation
// state lives in this component only (no persistence across reloads).
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING, greeting: true }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      // The synthetic opening greeting isn't a real turn — Claude requires
      // the conversation to start with a user message.
      const history = next.filter((m) => !m.greeting).map(({ role, content }) => ({ role, content }));
      const { reply } = await api.chat(history);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: FALLBACK_ERROR }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Clinic assistant chat"
            className="fixed inset-x-4 bottom-20 top-auto z-50 flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-[4.5rem] sm:w-96"
          >
            <BorderBeam size={80} duration={8} colorFrom="var(--color-primary)" colorTo="#38bdf8" />

            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar className="bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Stethoscope className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Clinic Assistant</p>
                <p className="truncate text-xs text-muted-foreground">Ask about hours, dentists, or services</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} />
              ))}
              {loading && <TypingIndicator />}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a message…"
                aria-label="Message"
                rows={1}
                className="max-h-24 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Button
                size="icon"
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open clinic assistant chat'}
        aria-expanded={open}
        className="size-14 rounded-full shadow-lg"
      >
        <motion.span
          key={open ? 'close' : 'open'}
          initial={{ rotate: -45, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        </motion.span>
      </Button>
    </div>
  );
}
