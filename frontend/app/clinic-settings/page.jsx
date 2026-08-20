'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { DAY_LABELS } from '@/lib/days';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Clock, ImageIcon } from 'lucide-react';

// Display order Mon..Sun (matches the dentist availability editor) —
// storage stays Sun=0..Sat=6 (JS Date#getDay()) to match the backend.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Admin-only — enforced two ways: the gateway rejects a non-admin's PUT
// (services/gateway/src/server.js), and lib/auth.js's route guard redirects
// a doctor away from this page entirely before it ever renders (it's in
// that file's ADMIN_ONLY_PATHS).
export default function ClinicSettingsPage() {
  const notify = useToast();
  const [form, setForm] = useState(null); // { clinic_name, logo_url, phone, address, hours: [...] }
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({ hours: {} });

  function fetchProfile() {
    api.getClinicProfile().then(setForm).catch((e) => setLoadError(e.message));
  }

  function retry() {
    setLoadError(null);
    fetchProfile();
  }

  useEffect(fetchProfile, []);

  function updateDay(day_of_week, patch) {
    setForm((prev) => ({
      ...prev,
      hours: prev.hours.map((h) => (h.day_of_week === day_of_week ? { ...h, ...patch } : h)),
    }));
  }

  function validate() {
    const next = { hours: {} };
    if (!form.clinic_name?.trim()) next.clinic_name = 'Clinic name is required';
    for (const h of form.hours) {
      if (h.is_closed) continue;
      if (!h.open_time || !h.close_time) next.hours[h.day_of_week] = 'Open and close times are required';
      else if (h.open_time >= h.close_time) next.hours[h.day_of_week] = 'Close time must be after open time';
    }
    setErrors(next);
    return !next.clinic_name && Object.keys(next.hours).length === 0;
  }

  async function save() {
    if (!validate()) {
      notify('Fix the highlighted fields before saving', 'err');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateClinicProfile(form);
      setForm(updated);
      setErrors({ hours: {} });
      notify('Clinic settings saved');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-3">Couldn&apos;t load clinic settings: {loadError}</p>
        <Button variant="outline" onClick={retry}>Retry</Button>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Clinic Settings</h1>
        <p className="text-muted-foreground">
          Edit the clinic&apos;s name, logo, contact info, and weekly hours — this will power the patient-facing booking pages once those exist.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4" /> Clinic profile</CardTitle>
            <CardDescription>Name, contact info, and logo shown to patients.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Clinic name</Label>
              <Input
                value={form.clinic_name}
                aria-invalid={!!errors.clinic_name}
                onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
              />
              {errors.clinic_name && <p className="text-xs text-destructive mt-1">{errors.clinic_name}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                placeholder="https://example.com/logo.png"
                value={form.logo_url || ''}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              />
              {form.logo_url && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary admin-pasted URL; next/image would require allowlisting every possible host */}
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    className="size-12 rounded border object-contain bg-white"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }}
                  />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="size-3.5" /> Preview
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4" /> Weekly hours</CardTitle>
            <CardDescription>Toggle a day fully closed, or set its open/close times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DISPLAY_ORDER.map((dow) => {
              const h = form.hours.find((x) => x.day_of_week === dow);
              if (!h) return null;
              const err = errors.hours?.[dow];
              return (
                <div key={dow} className="py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={!h.is_closed}
                      onCheckedChange={(checked) => updateDay(dow, { is_closed: !checked })}
                    />
                    <span className="w-20 text-sm shrink-0">{DAY_LABELS[dow]}</span>
                    {!h.is_closed ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Input
                          type="time" className="w-[7.5rem] h-7"
                          value={h.open_time}
                          aria-invalid={!!err}
                          onChange={(e) => updateDay(dow, { open_time: e.target.value })}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time" className="w-[7.5rem] h-7"
                          value={h.close_time}
                          aria-invalid={!!err}
                          onChange={(e) => updateDay(dow, { close_time: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    )}
                  </div>
                  {err && <p className="text-xs text-destructive mt-1 ml-[6.5rem]">{err}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button disabled={saving} onClick={save}>
          {saving && <Spinner />}
          Save clinic settings
        </Button>
      </div>
    </div>
  );
}
