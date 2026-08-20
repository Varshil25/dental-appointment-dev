'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email) return setError('Enter your email.');
    setBusy(true);
    try {
      // Backend always returns the same generic response whether or not the
      // email exists — mirrored here rather than branching on the result,
      // so this page can't be used to enumerate valid staff emails either.
      await api.forgotPassword(email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-bold mb-1">
            <span>🦷</span> Bright Smile Dental
          </div>
          <CardTitle className="text-base">Reset your password</CardTitle>
          <CardDescription>Enter your account email and we&apos;ll send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-sm flex items-start gap-2 bg-status-completed-bg text-status-completed-fg border border-status-completed-fg/20 rounded-md p-3">
              <MailCheck className="size-4 shrink-0 mt-0.5" />
              <span>If that email exists, we&apos;ve sent a password reset link. Check your inbox.</span>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <div>
                <Label>Email</Label>
                <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner />}
                Send reset link
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="size-3.5" /> Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
