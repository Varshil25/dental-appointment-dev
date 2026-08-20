'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ManageLookupForm({ onFound }) {
  const [id, setId] = useState('');
  const [contact, setContact] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!id.trim()) errs.id = 'Enter your booking reference';
    if (!contact.trim()) errs.contact = 'Enter the email or phone used to book';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const appt = await api.lookupAppointment(id.trim().replace(/^#/, ''), contact.trim());
      onFound(appt);
    } catch (err) {
      toast.error(err.status === 429 ? 'Too many attempts — please wait a bit and try again.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Manage your appointment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your booking reference along with the email or phone you booked with.
        </p>
      </div>

      <Card className="mt-8">
        <CardContent className="pt-6">
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <Label htmlFor="ref">Booking reference</Label>
              <Input
                id="ref"
                className="mt-1.5"
                placeholder="e.g. 1024 or #1024"
                value={id}
                onChange={(e) => setId(e.target.value)}
                aria-invalid={!!errors.id}
                aria-describedby={errors.id ? 'ref-error' : undefined}
              />
              {errors.id && <p id="ref-error" className="mt-1 text-xs text-destructive">{errors.id}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Found in your confirmation email.</p>
            </div>

            <div>
              <Label htmlFor="contact">Email or phone used to book</Label>
              <Input
                id="contact"
                className="mt-1.5"
                placeholder="you@example.com or +1 555 123 4567"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                aria-invalid={!!errors.contact}
                aria-describedby={errors.contact ? 'contact-error' : undefined}
              />
              {errors.contact && <p id="contact-error" className="mt-1 text-xs text-destructive">{errors.contact}</p>}
            </div>

            <Button type="submit" className="w-full rounded-full" disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Search className="mr-1.5 size-4" />}
              {loading ? 'Looking up…' : 'Find my appointment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
