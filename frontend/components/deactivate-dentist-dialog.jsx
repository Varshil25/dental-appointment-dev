'use client';

import { useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TriangleAlert } from 'lucide-react';

// Shown when an admin tries to set a dentist to "inactive" while they still
// have future booked appointments — the backend refuses the change outright
// (409) and hands back the affected list, so this dialog is the only place
// that status change can actually get made. `pendingBody` is the full
// PUT /dentists/:id body the profile form was about to send (status already
// 'inactive'); this just re-sends it with `on_conflict` added.
export function DeactivateDentistDialog({ dentistId, dentistName, pendingBody, conflict, onOpenChange, onDone }) {
  const notify = useToast();
  const [busy, setBusy] = useState(null); // 'cancel' | 'keep' | null

  const open = !!conflict;
  const appointments = conflict?.appointments || [];

  async function resolve(onConflict) {
    setBusy(onConflict);
    try {
      const updated = await api.updateDentist(dentistId, { ...pendingBody, on_conflict: onConflict });
      if (onConflict === 'cancel') {
        notify(`Dentist marked inactive. ${updated.cancelled_count} appointment${updated.cancelled_count === 1 ? '' : 's'} cancelled and patients notified.`);
      } else {
        notify('Dentist marked inactive. Existing appointments were left as-is.');
      }
      onOpenChange(false);
      onDone(updated);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-status-cancelled-fg" />
            {dentistName} has {conflict?.count} upcoming appointment{conflict?.count === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            Marking this dentist inactive won&apos;t remove these — choose what should happen to them first.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
          {appointments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-medium truncate">{a.patient_name}</span>
              <span className="text-muted-foreground shrink-0">{fmtDateTime(a.start_time)}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col! sm:flex-col! items-stretch gap-2">
          <Button variant="destructive" disabled={!!busy} onClick={() => resolve('cancel')}>
            {busy === 'cancel' && <Spinner />}
            Cancel these appointments
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => resolve('keep')}>
            {busy === 'keep' && <Spinner />}
            Keep appointments as-is, just mark inactive
          </Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => onOpenChange(false)}>
            Don&apos;t change status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
