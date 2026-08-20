'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { KeyRound, Mail } from 'lucide-react';

const RESEND_COOLDOWN = 45; // matches auth-service's config.otp.resendCooldownSeconds

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reference, setReference] = useState(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (step === 'otp') otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function submitCredentials(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const r = await api.login(email, password);
      setReference(r.reference);
      setStep('otp');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) return setError('Enter the 6-digit code.');
    setBusy(true);
    try {
      const { token } = await api.verifyOtp(reference, otp);
      setToken(token);
      await refresh();
      // Both roles land on '/' — the dashboard itself branches by role (see
      // app/page.jsx), same as how the sidebar and route guard do.
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setBusy(true);
    try {
      await api.resendOtp(reference);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
      if (err.data?.retryAfterSeconds) setCooldown(err.data.retryAfterSeconds);
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
          <CardTitle className="text-base">
            {step === 'credentials' ? 'Staff sign in' : 'Enter your code'}
          </CardTitle>
          <CardDescription>
            {step === 'credentials'
              ? 'Admin and doctor accounts only.'
              : `We've sent a 6-digit code to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'credentials' ? (
            <form className="space-y-3" onSubmit={submitCredentials}>
              <div>
                <Label>Email</Label>
                <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner />}
                <Mail className="size-4" /> {busy ? 'Sending code…' : 'Send login code'}
              </Button>
              <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-muted-foreground hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={submitOtp}>
              <div>
                <Label>6-digit code</Label>
                <Input
                  ref={otpInputRef}
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center text-lg tracking-[0.4em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner />}
                <KeyRound className="size-4" /> Verify &amp; sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
                  disabled={cooldown > 0 || busy}
                  onClick={resend}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                >
                  Use a different account
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
