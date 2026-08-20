'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { CheckCircle2, Download, Mail, CalendarDays, Stethoscope, Hash } from 'lucide-react';
import { fmtDate, fmtTime } from '@/lib/api';
import { downloadICS } from '@/lib/ics';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { Confetti } from '@/components/ui/confetti';
import { Button } from '@/components/ui/button';

export function StepConfirmation({ appointment }) {
  const { profile } = useClinicProfile();

  return (
    <div className="relative flex flex-col items-center py-6 text-center">
      <Confetti
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
        options={{ particleCount: 120, spread: 90, origin: { y: 0.3 }, colors: ['#0d9488', '#0891b2', '#38bdf8', '#99f6e4'] }}
      />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <CheckCircle2 className="size-9" />
      </motion.div>

      <h2 className="mt-6 text-2xl font-bold">You&apos;re all booked, {appointment.patient_name.split(' ')[0]}!</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        A confirmation email is on its way to <strong>{appointment.patient_email}</strong>.
      </p>

      <div className="mt-8 w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 text-left">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking reference</span>
          <span className="flex items-center gap-1 font-mono text-sm font-semibold">
            <Hash className="size-3.5 text-primary" />
            {appointment.id}
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1 text-sm">
          <CalendarDays className="size-4 shrink-0 text-primary" />
          <span>
            {fmtDate(appointment.start_time)} at {fmtTime(appointment.start_time)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Stethoscope className="size-4 shrink-0 text-primary" />
          <span>{appointment.dentist_name}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" className="rounded-full" onClick={() => downloadICS(appointment, profile)}>
          <Download className="mr-1.5 size-4" /> Add to calendar
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/book/manage">
            <Mail className="mr-1.5 size-4" /> Manage this booking
          </Link>
        </Button>
        <Button asChild className="rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
