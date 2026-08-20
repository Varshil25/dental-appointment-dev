'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, Send, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { isValidEmail, isRequiredPhone } from '@/lib/validation';
import { HoneypotField } from '@/components/honeypot-field';
import PhoneInput from '@/components/phone-input';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BlurFade } from '@/components/ui/blur-fade';

const empty = { name: '', email: '', phone: '', specialization: '', notes: '' };

function validate(v) {
  const errors = {};
  if (!v.name.trim()) errors.name = 'Name is required';
  if (!v.email.trim()) errors.email = 'Email is required';
  else if (!isValidEmail(v.email)) errors.email = 'Enter a valid email address';
  if (!v.phone) errors.phone = 'Phone number is required';
  else if (!isRequiredPhone(v.phone)) errors.phone = 'Enter a valid phone number';
  if (!v.specialization.trim()) errors.specialization = 'Specialization is required';
  return errors;
}

export default function JoinAsDentistPage() {
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
      await api.submitDentistApplication({ ...form, website: honeypot });
      setSent(true);
    } catch (err) {
      if (err.status === 429) toast.error('Too many applications submitted — please try again later.');
      else if (err.status === 409) toast.error(err.message);
      else toast.error(err.message);
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
          <BadgeCheck className="size-8" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-bold">Thanks — we&apos;ll review your application</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve received your application to join {profile?.clinic_name || 'our clinic'}. Our team will
          review it and be in touch by email soon.
        </p>
        <Button className="mt-8 rounded-full" onClick={() => { setSent(false); setForm(empty); }}>
          Submit another application
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <BlurFade inView>
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="size-6" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Join our clinic</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Are you a dentist looking for a new home? Tell us a bit about yourself below and our team will
            review your application.
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
                  <Label htmlFor="phone">Phone</Label>
                  <div className="mt-1.5">
                    <PhoneInput id="phone" value={form.phone} onChange={(v) => set('phone', v)} />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    className="mt-1.5"
                    placeholder="e.g. Orthodontics, General Dentistry"
                    value={form.specialization}
                    onChange={(e) => set('specialization', e.target.value)}
                    aria-invalid={!!errors.specialization}
                    aria-describedby={errors.specialization ? 'specialization-err' : undefined}
                  />
                  {errors.specialization && (
                    <p id="specialization-err" className="mt-1 text-xs text-destructive">{errors.specialization}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Qualifications / notes (optional)</Label>
                <Textarea
                  id="notes"
                  className="mt-1.5"
                  rows={5}
                  placeholder="Degrees, licensure, years of experience, anything you'd like us to know."
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>

              <HoneypotField value={honeypot} onChange={setHoneypot} />

              <Button type="submit" className="w-full rounded-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
                {submitting ? 'Submitting…' : 'Submit application'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
