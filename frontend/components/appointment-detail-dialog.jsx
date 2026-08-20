'use client';

import { fmtDateTime } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CalendarClock, CheckCircle2, UserX, XCircle, PlusCircle, TriangleAlert } from 'lucide-react';

// Detail/edit surface opened from a calendar event click. Reuses the same
// action handlers (and the same <RescheduleDialog/>, via `actions.reschedule`
// / `actions.followUp`) that the list view's row dropdown uses, so booking
// logic isn't duplicated between the two views.
export function AppointmentDetailDialog({ appt, open, onOpenChange, actions }) {
  if (!appt) return null;
  const busy = actions.pending?.id === appt.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appt.patient_name}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{fmtDateTime(appt.start_time)}</span>
            <StatusBadge status={appt.status} />
          </div>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Dentist</dt>
          <dd className="flex items-center gap-1.5">
            {appt.dentist_name}
            {appt.status === 'booked' && appt.dentist_status === 'inactive' && (
              <span className="inline-flex items-center gap-1 text-xs text-status-cancelled-fg">
                <TriangleAlert className="size-3.5" /> now inactive
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd>{appt.reason || '—'}</dd>
          {appt.follow_up_of && (
            <>
              <dt className="text-muted-foreground">Type</dt>
              <dd>Follow-up</dd>
            </>
          )}
        </dl>

        <DialogFooter className="flex-wrap justify-end!">
          {appt.status === 'booked' && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => { actions.reschedule(appt); onOpenChange(false); }}>
                <CalendarClock /> Reschedule
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.complete(appt)}>
                {busy && actions.pending?.action === 'complete' ? <Spinner /> : <CheckCircle2 />} Mark completed
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.noShow(appt)}>
                {busy && actions.pending?.action === 'no_show' ? <Spinner /> : <UserX />} Mark no-show
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => actions.cancel(appt)}>
                <XCircle /> Cancel
              </Button>
            </>
          )}
          {appt.status === 'completed' && (
            <Button variant="outline" size="sm" onClick={() => { actions.followUp(appt); onOpenChange(false); }}>
              <PlusCircle /> Book follow-up
            </Button>
          )}
          {appt.status !== 'booked' && appt.status !== 'completed' && (
            <p className="text-sm text-muted-foreground">No actions available</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
