'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Clock, Stethoscope, FileText, Hash, Loader2, XCircle } from 'lucide-react';
import { api, fmtDate, fmtTime } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const toDateStr = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function RescheduleDialog({ appt, open, onOpenChange, onDone }) {
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Deferred a microtask so the loading/slot reset isn't a synchronous
    // setState call within the effect body itself.
    Promise.resolve().then(() => {
      setLoading(true);
      setSlot(null);
    });
    api
      .slots(appt.dentist_id, date)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [open, appt.dentist_id, date]);

  async function confirm() {
    if (!slot) return;
    setSaving(true);
    try {
      const updated = await api.reschedule(appt.id, { start: slot.start, end: slot.end });
      toast.success('Appointment rescheduled');
      onDone(updated);
      onOpenChange(false);
    } catch (err) {
      if (err.status === 409) {
        toast.error('That slot was just taken — pick another time.');
        setSlot(null);
        api.slots(appt.dentist_id, date).then((r) => setSlots(r.slots));
      } else {
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>Pick a new date and time with {appt.dentist_name}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <Calendar
            mode="single"
            selected={new Date(date + 'T00:00:00')}
            onSelect={(d) => d && setDate(toDateStr(d))}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            className="rounded-xl border border-border"
          />
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Available times</p>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-16" />)}
              </div>
            ) : slots.some((s) => s.available) ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setSlot(s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      !s.available
                        ? 'cursor-not-allowed border-border/60 text-muted-foreground/50 line-through'
                        : slot?.start === s.start
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {fmtTime(s.start)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open slots this day — try another date.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={!slot || saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Confirm new time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ appt, open, onOpenChange, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      const updated = await api.cancel(appt.id, reason || undefined);
      toast.success('Appointment cancelled');
      onDone(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>This can&apos;t be undone — you&apos;ll need to book a new slot if you change your mind.</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea id="cancel-reason" className="mt-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep appointment</Button>
          <Button variant="destructive" onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Cancel appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppointmentManager({ appointment, onUpdated }) {
  const [appt, setAppt] = useState(appointment);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  function handleUpdated(updated) {
    setAppt(updated);
    onUpdated?.(updated);
  }

  const canModify = appt.status === 'booked';

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Hash className="size-3" /> Reference {appt.id}
              </p>
              <h1 className="mt-1 text-xl font-bold">Your appointment</h1>
            </div>
            <Badge variant={appt.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">
              {appt.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="size-4 shrink-0 text-primary" />
              {fmtDate(appt.start_time)}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="size-4 shrink-0 text-primary" />
              {fmtTime(appt.start_time)} – {fmtTime(appt.end_time)}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Stethoscope className="size-4 shrink-0 text-primary" />
              {appt.dentist_name}
            </div>
            {appt.reason && (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="size-4 shrink-0 text-primary" />
                {appt.reason}
              </div>
            )}
          </div>

          {canModify ? (
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </Button>
              <Button variant="outline" className="flex-1 rounded-full text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-1.5 size-4" /> Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
              This appointment is {appt.status.replace('_', ' ')} and can no longer be changed online — please call us if you need help.
            </p>
          )}
        </CardContent>
      </Card>

      <RescheduleDialog appt={appt} open={rescheduleOpen} onOpenChange={setRescheduleOpen} onDone={handleUpdated} />
      <CancelDialog appt={appt} open={cancelOpen} onOpenChange={setCancelOpen} onDone={handleUpdated} />
    </div>
  );
}
