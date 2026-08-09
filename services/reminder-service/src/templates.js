import { config } from './config.js';

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

const firstName = (fullName) => (fullName || '').trim().split(' ')[0] || fullName;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const BRAND_COLOR = '#0f766e';

// Same design as appointment-service's templates.js — duplicated rather than
// shared over a network hop, since it's a handful of short string-builders
// and reminder-service is meant to stay fully self-contained.
function renderEmail({ badge, badgeBg, badgeColor, heading, intro, rows, closing }) {
  const { name, phone, address } = config.clinic;
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;width:88px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  return `
<div style="background:#f4f6f8;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:${BRAND_COLOR};padding:22px 32px;">
        <span style="font-size:18px;font-weight:700;color:#ffffff;">&#129688; ${escapeHtml(name)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(badge)}</span>
        <h1 style="font-size:19px;margin:14px 0 10px;color:#111827;">${escapeHtml(heading)}</h1>
        <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0 0 20px;">${escapeHtml(intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;">
          <tr>
            <td style="padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rowsHtml}
              </table>
            </td>
          </tr>
        </table>
        <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:20px 0 0;">${escapeHtml(closing)}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #eef0f2;">
        <p style="font-size:12px;color:#9ca3af;margin:0;">${escapeHtml(name)} &middot; ${escapeHtml(phone)} &middot; ${escapeHtml(address)}</p>
      </td>
    </tr>
  </table>
</div>`;
}

export function reminderSms(r) {
  return (
    `${config.clinic.name}: Hi ${firstName(r.patient_name)}, reminder — your appointment with ` +
    `${r.dentist_name || 'us'} is on ${fmt(r.appt_start_time)}. ` +
    `Reschedule/cancel: ${config.clinic.phone}`
  );
}

export function reminderTemplate(r) {
  const subject = `Reminder: your dental appointment on ${fmt(r.appt_start_time)}`;
  const text =
    `Hi ${r.patient_name},\n\n` +
    `This is a reminder of your upcoming appointment at ${config.clinic.name}.\n\n` +
    `  When:    ${fmt(r.appt_start_time)}\n` +
    `  Dentist: ${r.dentist_name || 'TBD'}\n` +
    `  Reason:  ${r.appt_reason || 'General visit'}\n` +
    `  Where:   ${config.clinic.address}\n\n` +
    `Need to reschedule or cancel? Call us at ${config.clinic.phone}.\n\n` +
    `See you soon,\n${config.clinic.name}`;
  const html = renderEmail({
    badge: 'Reminder',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    heading: `See you soon, ${firstName(r.patient_name)}`,
    intro: `This is a reminder of your upcoming appointment at ${config.clinic.name}.`,
    rows: [
      ['When', fmt(r.appt_start_time)],
      ['Dentist', r.dentist_name || 'TBD'],
      ['Reason', r.appt_reason || 'General visit'],
      ['Where', config.clinic.address],
    ],
    closing: `Need to reschedule or cancel? Call us at ${config.clinic.phone}.`,
  });
  return { subject, text, html };
}
