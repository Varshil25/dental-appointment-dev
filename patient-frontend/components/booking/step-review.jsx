'use client';

import { Pencil, Stethoscope, CalendarDays, Clock, User, FileText } from 'lucide-react';
import { fmtDate, fmtTime } from '@/lib/api';
import { Button } from '@/components/ui/button';

function Row({ icon: Icon, label, value, onEdit }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4.5 shrink-0 text-primary" />
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-sm font-medium">{value}</div>
        </div>
      </div>
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit} className="shrink-0 text-muted-foreground">
          <Pencil className="mr-1 size-3.5" /> Edit
        </Button>
      )}
    </div>
  );
}

export function StepReview({ state, dentistName, onEditStep }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Review & confirm</h2>
      <p className="mt-1 text-sm text-muted-foreground">Double-check everything before we lock in your slot.</p>

      <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card px-5">
        <Row icon={FileText} label="Reason for visit" value={state.reason} onEdit={() => onEditStep(1)} />
        <Row icon={Stethoscope} label="Dentist" value={dentistName} onEdit={() => onEditStep(2)} />
        <Row
          icon={CalendarDays}
          label="Date"
          value={state.slot ? fmtDate(state.slot.start) : '—'}
          onEdit={() => onEditStep(3)}
        />
        <Row
          icon={Clock}
          label="Time"
          value={state.slot ? `${fmtTime(state.slot.start)} – ${fmtTime(state.slot.end)}` : '—'}
        />
        <Row
          icon={User}
          label="Patient"
          value={`${state.patient.name} · ${state.patient.email}${state.patient.phone ? ` · ${state.patient.phone}` : ''}`}
          onEdit={() => onEditStep(4)}
        />
        {state.patient.notes && <Row icon={FileText} label="Notes" value={state.patient.notes} />}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        By confirming, you agree to receive a booking confirmation and reminder emails for this appointment.
      </p>
    </div>
  );
}
