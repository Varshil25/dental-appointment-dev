'use client';

import { useEffect, useState } from 'react';

// Matches appointment-service's autoComplete.js grace period (5 min) plus a
// little slack for the cron's own up-to-2-minute tick interval — purely
// cosmetic here (just how long "Completing…" shows before this component
// gives up waiting and goes quiet on its own), the parent page's polling
// effect (see pages/appointments.jsx) is what actually notices the real
// status flip and re-renders this component away entirely.
const AUTO_COMPLETE_GRACE_MS = 7 * 60 * 1000;

// Live, locally-ticking "in progress" countdown for one appointment — no
// per-second network calls, just a 1s setInterval computing against the
// already-known start_time/end_time (same idiom as the OTP resend cooldown
// in pages/login.jsx). Renders nothing for an appointment that isn't
// currently active: not yet started, already finished, or no longer
// 'booked' (a manual no_show/cancel/reschedule changes the row the parent
// passes in on its next refetch, which naturally stops this from rendering
// — no separate edge-case handling needed here).
export function AppointmentCountdown({ appt }) {
  const [now, setNow] = useState(() => Date.now());

  const start = new Date(appt.start_time).getTime();
  const end = new Date(appt.end_time).getTime();
  const inProgress = appt.status === 'booked' && now >= start && now < end;
  const awaitingAutoComplete = appt.status === 'booked' && now >= end && now < end + AUTO_COMPLETE_GRACE_MS;

  useEffect(() => {
    if (!inProgress && !awaitingAutoComplete) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inProgress, awaitingAutoComplete]);

  if (awaitingAutoComplete) {
    return <span className="text-xs italic text-muted-foreground">Completing…</span>;
  }
  if (!inProgress) return null;

  const remainingMs = end - now;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const label = mins > 0 ? `${mins} min remaining` : `${secs}s remaining`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-booked-fg">
      <span className="size-1.5 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}
