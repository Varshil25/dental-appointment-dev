'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/use-toast';

// Shared reschedule/cancel/status-change logic for appointments, used by
// both the list view and the calendar view so they stay in sync and only
// one <RescheduleDialog> instance is ever mounted.
export function useAppointmentActions(onChanged) {
  const notify = useToast();
  const [modal, setModal] = useState(null); // { appt, mode: 'reschedule' | 'follow-up' }
  const [pending, setPending] = useState(null); // { id, action }

  async function act(id, action, fn, okMsg) {
    setPending({ id, action });
    try {
      await fn();
      notify(okMsg);
      onChanged();
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setPending(null);
    }
  }

  const complete = (a) => act(a.id, 'complete', () => api.setStatus(a.id, 'completed'), 'Marked completed');
  const noShow = (a) => act(a.id, 'no_show', () => api.setStatus(a.id, 'no_show'), 'Marked no-show');

  const cancel = (a) => {
    const reason = window.prompt('Cancellation reason (optional):', '');
    if (reason === null) return;
    act(a.id, 'cancel', () => api.cancel(a.id, reason), 'Cancelled — patient notified');
  };

  const reschedule = (a) => setModal({ appt: a, mode: 'reschedule' });
  const followUp = (a) => setModal({ appt: a, mode: 'follow-up' });

  return { modal, setModal, pending, act, complete, noShow, cancel, reschedule, followUp };
}
