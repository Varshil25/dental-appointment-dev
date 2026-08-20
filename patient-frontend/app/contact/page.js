'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { MailCheck, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import { HoneypotField } from '@/components/honeypot-field';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlurFade } from '@/components/ui/blur-fade';

const SUBJECTS = ['General Question', 'Insurance/Billing', 'Feedback', 'Other'];

const empty = { name: '', email: '', phone: '', subject: '', message: '' };

function validate(v) {
  const errors = {};
  if (!v.name.trim()) errors.name = 'Name is required';
  if (!v.email.trim()) errors.email = 'Email is required';
  else if (!isValidEmail(v.email)) errors.email = 'Enter a valid email address';
  if (v.phone && !isValidPhone(v.phone)) errors.phone = 'Enter a valid phone number (e.g. +1 5551234567)';
  if (!v.subject) errors.subject = 'Choose a topic';
  if (!v.message.trim()) errors.message = 'Please enter a message';
  else if (v.message.trim().length < 10) errors.message = 'Please add a few more details (10+ characters)';
  return errors;
}

export default function ContactPage() {
  const { profile } = useClinicProfile();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await api.submitInquiry({ ...form, phone: form.phone || undefined, website: honeypot });
      setSent(true);
    } catch (err) {
      toast.error(err.status === 429 ? 'Too many messages sent — please try again later.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <MailCheck className="size-8" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-bold">Thanks — we&apos;ll get back to you</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your message has been sent to {profile?.clinic_name || 'our team'}. We usually reply within one business day.
        </p>
        <Button className="mt-8 rounded-full" onClick={() => { setSent(false); setForm(empty); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <BlurFade inView>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Get in touch</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Have a general question, a billing issue, or feedback for us? Send a message below — for booking, use{' '}
            <a href="/book" className="text-primary hover:underline">Book an Appointment</a> instead.
          </p>
        </div>
      </BlurFade>

      <BlurFade inView delay={0.08}>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <form onSubmit={submit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    className="mt-1.5"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-err' : undefined}
                  />
                  {errors.name && <p id="name-err" className="mt-1 text-xs text-destructive">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="mt-1.5"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-err' : undefined}
                  />
                  {errors.email && <p id="email-err" className="mt-1 text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    className="mt-1.5"
                    placeholder="+1 5551234567"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-err' : undefined}
                  />
                  {errors.phone && <p id="phone-err" className="mt-1 text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="subject">Topic</Label>
                  <Select value={form.subject} onValueChange={(v) => set('subject', v)}>
                    <SelectTrigger id="subject" className="mt-1.5 w-full" aria-invalid={!!errors.subject}>
                      <SelectValue placeholder="Choose a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  className="mt-1.5"
                  rows={5}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? 'message-err' : undefined}
                />
                {errors.message && <p id="message-err" className="mt-1 text-xs text-destructive">{errors.message}</p>}
              </div>

              <HoneypotField value={honeypot} onChange={setHoneypot} />

              <Button type="submit" className="w-full rounded-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
                {submitting ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
