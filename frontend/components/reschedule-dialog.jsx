'use client';

import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { SlotPicker } from '@/components/slot-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';

// Replaces the old hand-rolled SlotModal overlay. `mode` is
// 'reschedule' | 'follow-up'; `appt` is the appointment being acted on.
export function RescheduleDialog({ appt, mode, open, onOpenChange, onDone }) {
  const notify = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !appt) return;
    let ignore = false;
    async function loadSlots() {
      setSlot(null);
      setSlotsLoading(true);
      try {
        const r = await api.slots(appt.dentist_id, date);
        if (!ignore) setSlots(r.slots);
      } catch {
        if (!ignore) setSlots([]);
      } finally {
        if (!ignore) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => { ignore = true; };
  }, [open, appt, date]);

  async function submit() {
    if (!slot) return notify('Pick a slot', 'err');
    setBusy(true);
    try {
      if (mode === 'reschedule') {
        await api.reschedule(appt.id, { start: slot.start, end: slot.end });
        notify('Rescheduled — reminders re-issued');
      } else {
        await api.followUp(appt.id, { start: slot.start, end: slot.end });
        notify('Follow-up booked — email sent');
      }
      onDone();
      onOpenChange(false);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!appt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'reschedule' ? 'Reschedule' : 'Book follow-up'} — {appt.patient_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {appt.dentist_name} · currently {fmtDateTime(appt.start_time)}
          </p>
        </DialogHeader>

        <Label>New date</Label>
        <Input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {slotsLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-16" />)}
          </div>
        ) : (
          <SlotPicker slots={slots} selected={slot} onSelect={setSlot} />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !slot} onClick={submit}>
            {busy && <Spinner />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
