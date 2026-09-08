import cron from 'node-cron';
import { pool } from './db.js';
import { config } from './config.js';
import { invalidateAll } from './cache.js';
import { applyStatusSideEffects } from './statusUpdate.js';

// Auto-completes appointments an admin never manually closed out: once
// start_time + slot duration (end_time, already stored per-appointment —
// see resolveTimes in routes/appointments.js) plus a grace period has
// passed, a still-'booked' appointment is assumed to have happened and is
// flipped to 'completed' automatically, triggering the same review-request
// email/SMS a manual completion would (see statusUpdate.js).
//
// Lives in appointment-service rather than reminder-service (the other
// service with a cron pattern to copy) because it needs to both read AND
// write appointments.status directly — reminder-service deliberately never
// looks up appointment data itself (see reminders.js's file comment), it
// only acts on denormalized snapshots pushed to it. Doing the read/write
// here also means one direct DB transaction on the row it's changing,
// instead of a self-referential HTTP round-trip from this service back to
// its own PATCH /:id/status endpoint.
//
// The `WHERE status = 'booked'` guard is what makes "manual action always
// wins" hold: this UPDATE only ever matches rows still sitting as 'booked'
// at the instant it runs. If an admin already moved a row to 'no_show' or
// 'completed' (or it's 'cancelled') before this tick, it silently no longer
// matches — no separate check-then-act step, so there's no window where
// this job could read a since-changed row and act on stale data. The
// reverse race (this job's UPDATE committing a heartbeat before an admin's
// manual action for the same row) is not fully eliminated — an inherent tiny
// window in any concurrent system — but is astronomically unlikely at this
// app's traffic level and cron interval.
async function claimAndCompleteDueAppointments() {
  const cutoffISO = new Date(Date.now() - config.autoCompleteGraceMinutes * 60 * 1000).toISOString();
  const { rows } = await pool.query(
    `UPDATE appointments SET status = 'completed'
      WHERE status = 'booked' AND end_time <= $1
      RETURNING *`,
    [cutoffISO]
  );
  for (const row of rows) {
    await applyStatusSideEffects(row, 'completed');
  }
  if (rows.length) await invalidateAll();
  return rows.length;
}

let tickRunning = false;

export function startAutoCompleteScheduler() {
  let schedule = config.autoCompleteCron;
  if (!cron.validate(schedule)) {
    console.warn(`[auto-complete] invalid cron "${schedule}", using "*/2 * * * *"`);
    schedule = '*/2 * * * *';
  }
  cron.schedule(schedule, async () => {
    // Belt-and-suspenders alongside the atomic claim above: skip a tick
    // outright if the previous one is still draining a large batch — same
    // pattern as reminder-service's scheduler.
    if (tickRunning) return;
    tickRunning = true;
    try {
      const n = await claimAndCompleteDueAppointments();
      if (n) console.log(`[auto-complete] auto-completed ${n} appointment(s) past end_time + ${config.autoCompleteGraceMinutes}m grace`);
    } catch (err) {
      console.error('[auto-complete] scheduler error:', err.message);
    } finally {
      tickRunning = false;
    }
  });
  console.log(
    `[auto-complete] scheduler active (cron "${schedule}", ${config.autoCompleteGraceMinutes}m grace period)`
  );
}
