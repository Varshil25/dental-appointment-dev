'use client';

import { useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import { findExistingPatient } from '@/lib/patient-lookup';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from '@/components/phone-input';
import { Spinner } from '@/components/ui/spinner';
import { HoneypotField } from '@/components/honeypot-field';

export function StepDetails({ patient, onChange, matchedPatient, onMatchedPatient, errors, honeypot, onHoneypotChange }) {
  const [checking, setChecking] = useState(false);

  function set(field, val) {
    onChange({ ...patient, [field]: val });
  }

  async function tryMatch() {
    if (!patient.email && !patient.phone) return;
    setChecking(true);
    try {
      const found = await findExistingPatient({ email: patient.email, phone: patient.phone });
      if (found) {
        onMatchedPatient(found);
        onChange({
          name: found.name,
          email: found.email,
          phone: found.phone || patient.phone,
          dob: found.dob ? found.dob.slice(0, 10) : patient.dob,
          notes: patient.notes,
        });
      } else if (matchedPatient) {
        onMatchedPatient(null);
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll use this to confirm your booking and send reminders.
      </p>

      {matchedPatient && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <PartyPopper className="size-4 shrink-0" />
          Welcome back, {matchedPatient.name.split(' ')[0]}! We&apos;ve filled in your details.
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            className="mt-1.5"
            value={patient.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && <p id="name-error" className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email {checking && <Spinner className="ml-1 inline size-3" />}</Label>
          <Input
            id="email"
            type="email"
            className="mt-1.5"
            value={patient.email}
            onChange={(e) => set('email', e.target.value)}
            onBlur={tryMatch}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && <p id="email-error" className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Phone (optional)</Label>
          <div className="mt-1.5">
            <PhoneInput id="phone" value={patient.phone} onChange={(v) => set('phone', v)} onBlur={tryMatch} />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div>
          <Label htmlFor="dob">Date of birth (optional)</Label>
          <Input
            id="dob"
            type="date"
            className="mt-1.5"
            max={new Date().toISOString().slice(0, 10)}
            value={patient.dob}
            onChange={(e) => set('dob', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="notes">Anything we should know? (optional)</Label>
          <Textarea
            id="notes"
            className="mt-1.5"
            rows={3}
            placeholder="Allergies, anxiety about visits, specific concerns…"
            value={patient.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </div>

      <HoneypotField value={honeypot} onChange={onHoneypotChange} />
    </div>
  );
}

export function validateDetails(patient) {
  const errors = {};
  if (!patient.name?.trim()) errors.name = 'Name is required';
  if (!patient.email?.trim()) errors.email = 'Email is required';
  else if (!isValidEmail(patient.email)) errors.email = 'Enter a valid email address';
  if (patient.phone && !isValidPhone(patient.phone)) errors.phone = 'Enter a valid phone number';
  return errors;
}
