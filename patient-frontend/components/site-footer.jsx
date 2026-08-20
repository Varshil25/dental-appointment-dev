'use client';

import Link from 'next/link';
import { MapPin, Phone, Clock, Stethoscope } from 'lucide-react';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { DAY_NAMES, fmtHour12 } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { BorderBeam } from '@/components/ui/border-beam';

function HoursList({ hours }) {
  if (!hours) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-40" />)}
      </div>
    );
  }
  const sorted = [...hours].sort((a, b) => a.day_of_week - b.day_of_week);
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {sorted.map((h) => (
        <li key={h.day_of_week} className="flex justify-between gap-6">
          <span>{DAY_NAMES[h.day_of_week]}</span>
          <span className="tabular-nums">
            {h.is_closed ? 'Closed' : `${fmtHour12(h.open_time)} – ${fmtHour12(h.close_time)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  const { profile } = useClinicProfile();

  return (
    <footer className="relative overflow-hidden border-t border-border/70 bg-secondary/40">
      <BorderBeam size={200} duration={10} colorFrom="var(--primary)" colorTo="var(--chart-2)" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Stethoscope className="size-4" />
            </span>
            {profile?.clinic_name || <Skeleton className="h-5 w-32" />}
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Gentle, modern dental care for the whole family. Book online in under two minutes.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">Contact</h3>
          {profile ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {profile.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-primary" />
                  <a href={`tel:${profile.phone}`} className="hover:text-foreground">{profile.phone}</a>
                </li>
              )}
              {profile.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="size-4 shrink-0 mt-0.5 text-primary" />
                  <span>{profile.address}</span>
                </li>
              )}
            </ul>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
            <Link href="/book" className="text-primary hover:underline">Book Appointment</Link>
            <Link href="/book/manage" className="text-primary hover:underline">Manage Booking</Link>
            <Link href="/contact" className="text-primary hover:underline">Contact Us</Link>
          </div>
          <div className="pt-2 text-sm text-muted-foreground">
            Are you a dentist?{' '}
            <Link href="/join-as-dentist" className="text-primary hover:underline">Join our clinic</Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground/80">
            <Clock className="size-4" /> Hours
          </h3>
          <HoursList hours={profile?.hours} />
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {profile?.clinic_name || 'Dental Clinic'}. All rights reserved.
      </div>
    </footer>
  );
}
