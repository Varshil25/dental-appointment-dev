'use client';

import { MapPin, Phone, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { DAY_NAMES, fmtHour12 } from '@/lib/api';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { GridPattern } from '@/components/ui/grid-pattern';

function todayDow() {
  return new Date().getDay();
}

export function ClinicInfoSection() {
  const router = useRouter();
  const { profile, loading } = useClinicProfile();
  const today = todayDow();
  const sortedHours = profile?.hours ? [...profile.hours].sort((a, b) => a.day_of_week - b.day_of_week) : null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <BlurFade inView>
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary/40 p-8 lg:col-span-2">
            <GridPattern className="text-primary/10 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]" />
            <div className="relative">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">Visit Us</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Find our clinic</h2>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                  {loading ? <Skeleton className="h-5 w-48" /> : (
                    <span className="text-sm">{profile?.address || 'Address coming soon'}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="size-5 shrink-0 text-primary" />
                  {loading ? <Skeleton className="h-5 w-32" /> : (
                    <a href={`tel:${profile?.phone}`} className="text-sm hover:underline">
                      {profile?.phone || 'Phone coming soon'}
                    </a>
                  )}
                </div>
              </div>

              <Button className="mt-8 rounded-full" onClick={() => router.push('/book')}>
                Book an appointment
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 lg:col-span-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="size-4.5 text-primary" /> Opening hours
            </h3>
            <div className="mt-5 divide-y divide-border">
              {!sortedHours &&
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              {sortedHours?.map((h) => (
                <div
                  key={h.day_of_week}
                  className={`flex items-center justify-between py-2.5 text-sm ${
                    h.day_of_week === today ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span>
                    {DAY_NAMES[h.day_of_week]}
                    {h.day_of_week === today && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                        Today
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {h.is_closed ? 'Closed' : `${fmtHour12(h.open_time)} – ${fmtHour12(h.close_time)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}
