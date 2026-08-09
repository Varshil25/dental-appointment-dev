import { config } from '../config.js';

// Push a denormalized snapshot into reminder-service so its cron loop
// never needs to call back into appointment-service to build an email.
export async function scheduleReminders(snapshot) {
  const res = await fetch(`${config.reminderServiceUrl}/internal/reminders/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) throw new Error(`reminder-service responded ${res.status}`);
}

export async function cancelReminders(appointmentId) {
  const res = await fetch(`${config.reminderServiceUrl}/internal/reminders/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentId }),
  });
  if (!res.ok) throw new Error(`reminder-service responded ${res.status}`);
}

export async function remindersSummary() {
  const res = await fetch(`${config.reminderServiceUrl}/internal/reminders-summary`);
  if (!res.ok) throw new Error(`reminder-service responded ${res.status}`);
  return res.json();
}
