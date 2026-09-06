'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Send } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { StarRating } from '@/components/review/star-rating';
import { HoneypotField } from '@/components/honeypot-field';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function CenteredMessage({ title, body }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function ReviewForm({ appointmentId }) {
  const [state, setState] = useState(appointmentId ? 'loading' : 'not-found'); // loading | form | not-found | ineligible | already-reviewed | done
  const [context, setContext] = useState(null); // { dentist_name, start_time }
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    api
      .getReviewEligibility(appointmentId)
      .then((res) => {
        setContext({ dentist_name: res.dentist_name, start_time: res.start_time });
        if (res.already_reviewed) setState('already-reviewed');
        else if (!res.eligible) setState('ineligible');
        else setState('form');
      })
      .catch(() => setState('not-found'));
  }, [appointmentId]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!rating) errs.rating = 'Pick a star rating';
    if (!contact.trim()) errs.contact = 'Enter the email or phone used to book';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await api.submitReview({
        appointment_id: Number(appointmentId),
        contact: contact.trim(),
        rating,
        comment: comment.trim() || undefined,
        website,
      });
      setState('done');
    } catch (err) {
      // Business-logic rejections (already reviewed / not eligible / no
      // matching appointment) get their own friendly full-page state
      // rather than a raw error — the same states the initial eligibility
      // check can land on, since either check can race a status change.
      if (err.status === 409) setState('already-reviewed');
      else if (err.status === 400 && /not eligible/.test(err.message)) setState('ineligible');
      else if (err.status === 404) setState('not-found');
      else if (err.status === 429) toast.error('Too many attempts — please wait a bit and try again.');
      else toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-24 sm:px-6">
        <Skeleton className="h-7 w-48 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state === 'not-found') {
    return (
      <CenteredMessage
        title="We couldn't find that appointment"
        body="Double-check the link from your email or text — or it may no longer be available."
      />
    );
  }

  if (state === 'ineligible') {
    return (
      <CenteredMessage
        title="Not ready for a review yet"
        body="This appointment isn't marked as completed yet. Once your visit is wrapped up, we'll send you a link to leave a review."
      />
    );
  }

  if (state === 'already-reviewed') {
    return (
      <CenteredMessage
        title="You've already reviewed this visit"
        body="Thanks again for taking the time — your feedback has already been recorded."
      />
    );
  }

  if (state === 'done') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h1 className="mt-4 text-xl font-bold">Thank you for your feedback!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your review helps other patients and helps us do better. We really appreciate it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          How was your visit{context?.dentist_name ? ` with ${context.dentist_name}` : ''}?
        </h1>
        {context?.start_time && (
          <p className="mt-2 text-sm text-muted-foreground">On {fmtDate(context.start_time)}</p>
        )}
      </div>

      <Card className="mt-8">
        <CardContent className="pt-6">
          <form onSubmit={submit} noValidate className="space-y-5">
            <HoneypotField value={website} onChange={setWebsite} />

            <div>
              <Label>Your rating</Label>
              <div className="mt-2">
                <StarRating value={rating} onChange={setRating} disabled={submitting} />
              </div>
              {errors.rating && <p className="mt-1 text-xs text-destructive">{errors.rating}</p>}
            </div>

            <div>
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                className="mt-1.5"
                rows={4}
                placeholder="Tell us about your visit…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={submitting}
              />
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
                disabled={submitting}
              />
              {errors.contact && <p id="contact-error" className="mt-1 text-xs text-destructive">{errors.contact}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Just to confirm it&apos;s really you — no account needed.</p>
            </div>

            <Button type="submit" className="w-full rounded-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
              {submitting ? 'Submitting…' : 'Submit review'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
