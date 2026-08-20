'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

// Same 8+ chars / letter+digit rule auth-service enforces server-side —
// checked here too so a mismatched password only ever fails fast in the
// UI, not as a round-trip to the API.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Skeleton className="h-64 w-full max-w-sm" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!PASSWORD_RE.test(password)) {
      return setError('Password must be at least 8 characters and include a letter and a number.');
    }
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-bold mb-1">
            <span>🦷</span> Bright Smile Dental
          </div>
          <CardTitle className="text-base">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-destructive">
              This link is missing its reset token — use the link from your email, or{' '}
              <Link href="/forgot-password" className="underline">request a new one</Link>.
            </p>
          ) : done ? (
            <p className="text-sm text-status-completed-fg">
              Password updated — redirecting to sign in…
            </p>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <div>
                <Label>New password</Label>
                <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner />}
                Reset password
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
