import cron from 'node-cron';
import { pool } from './db.js';
import { config } from './config.js';
import { sendMail, sendSms } from './clients/notificationServiceClient.js';
import { reminderTemplate, reminderSms } from './templates.js';

// Create pending reminder rows for an appointment based on the configured
// offsets, from a snapshot pushed by appointment-service (we don't own
// appointment data, so we never look it up ourselves). One 'email' row is
// always created per offset; a matching 'sms' row is added alongside it
// when a phone number is available — both channels fire independently.
export async function scheduleReminders(snapshot) {
  const { appointmentId, startTimeISO, patientEmail, patientPhone, patientName, dentistName, reason } = snapshot;
  const startMs = new Date(startTimeISO).getTime();
  const now = Date.now();
  for (const offset of config.reminderOffsetsHours) {
    const when = startMs - offset * 3600 * 1000;
    const status = when <= now ? 'skipped' : 'pending';
    const channels = patientPhone ? ['email', 'sms'] : ['email'];
    for (const channel of channels) {
      await pool.query(
        `INSERT INTO reminders
           (appointment_id, channel, offset_hours, scheduled_for, status,
            patient_email, patient_phone, patient_name, dentist_name, appt_start_time, appt_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          appointmentId, channel, offset, new Date(when).toISOString(), status,
          patientEmail, patientPhone || null, patientName, dentistName || null, startTimeISO, reason || null,
        ]
      );
    }
  }
}

// Cancel outstanding reminders (e.g. when an appointment is cancelled/rescheduled/no longer booked).
export async function cancelPendingReminders(appointmentId) {
  await pool.query(
    `UPDATE reminders SET status = 'skipped'
      WHERE appointment_id = $1 AND status IN ('pending', 'sending')`,
    [appointmentId]
  );
}

// Send one reminder row now and record the result. Used both by the cron
// loop (row already claimed as 'sending') and by the manual "send now"
// endpoint (claims it itself first).
export async function fireReminder(reminderId) {
  const { rows } = await pool.query('SELECT * FROM reminders WHERE id = $1', [reminderId]);
  const reminder = rows[0];
  if (!reminder) return { ok: false, detail: 'reminder not found' };

  let ok, detail;
  if (reminder.channel === 'sms') {
    ({ ok, detail } = await sendSms(reminder.patient_phone, reminderSms(reminder)));
  } else {
    const { subject, text, html } = reminderTemplate(reminder);
    ({ ok, detail } = await sendMail(reminder.patient_email, { subject, text, html }));
  }
  await pool.query(
    `UPDATE reminders SET status = $1, sent_at = $2, detail = $3 WHERE id = $4`,
    [ok ? 'sent' : 'failed', new Date().toISOString(), detail, reminderId]
  );
  return { ok, detail };
}

// Manual "send now": claims the row itself (any status) so a demo can
// re-send, then fires it.
export async function fireReminderNow(reminderId) {
  const { rows } = await pool.query('SELECT id FROM reminders WHERE id = $1', [reminderId]);
  if (!rows[0]) return { ok: false, detail: 'reminder not found' };
  await pool.query(`UPDATE reminders SET status = 'sending' WHERE id = $1`, [reminderId]);
  return fireReminder(reminderId);
}

// Atomically claim every due, still-pending reminder (UPDATE ... RETURNING)
// so an overlapping cron tick's `WHERE status='pending'` can no longer see
// rows another tick is already sending — fixes duplicate sends when SMTP
// delivery for a batch takes longer than one cron interval.
async function claimDueReminders() {
  const nowISO = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE reminders SET status = 'sending'
      WHERE status = 'pending' AND scheduled_for <= $1
      RETURNING id`,
    [nowISO]
  );
  return rows;
}

async function processDueReminders() {
  const claimed = await claimDueReminders();
  for (const { id } of claimed) {
    await fireReminder(id);
  }
  return claimed.length;
}

let tickRunning = false;

export function startReminderScheduler() {
  if (!cron.validate(config.reminderCron)) {
    console.warn(`[reminders] invalid cron "${config.reminderCron}", using "* * * * *"`);
    config.reminderCron = '* * * * *';
  }
  cron.schedule(config.reminderCron, async () => {
    // Belt-and-suspenders alongside the atomic claim above: skip a tick
    // outright if the previous one is still draining a large batch.
    if (tickRunning) return;
    tickRunning = true;
    try {
      const n = await processDueReminders();
      if (n) console.log(`[reminders] processed ${n} due reminder(s)`);
    } catch (err) {
      console.error('[reminders] scheduler error:', err.message);
    } finally {
      tickRunning = false;
    }
  });
  console.log(
    `[reminders] scheduler active (cron "${config.reminderCron}", ` +
      `offsets ${config.reminderOffsetsHours.join('h, ')}h before)`
  );
}
