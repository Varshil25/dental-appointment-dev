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

// Table-based layout with inline styles throughout — the only markup style
// that renders consistently across Gmail/Outlook/Apple Mail, none of which
// can be relied on to support a <style> block or modern CSS layout.
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

export function bookingTemplate(appt) {
  const subject = `Appointment confirmed — ${fmt(appt.start_time)}`;
  const text =
    `Hi ${appt.patient_name},\n\n` +
    `Your appointment at ${config.clinic.name} is confirmed.\n\n` +
    `  When:    ${fmt(appt.start_time)}\n` +
    `  Dentist: ${appt.dentist_name}\n` +
    `  Reason:  ${appt.reason || 'General visit'}\n\n` +
    `We'll send you a reminder before your visit.\n` +
    `To change your booking, call ${config.clinic.phone}.\n\n` +
    `Thank you,\n${config.clinic.name}`;
  const html = renderEmail({
    badge: 'Confirmed',
    badgeBg: '#d1fae5',
    badgeColor: '#059669',
    heading: `You're booked, ${firstName(appt.patient_name)}`,
    intro: `Your appointment at ${config.clinic.name} is confirmed. We'll send you a reminder before your visit.`,
    rows: [
      ['When', fmt(appt.start_time)],
      ['Dentist', appt.dentist_name],
      ['Reason', appt.reason || 'General visit'],
    ],
    closing: `Need to reschedule or cancel? Call us at ${config.clinic.phone}.`,
  });
  return { subject, text, html };
}

export function cancellationTemplate(appt) {
  const subject = `Appointment cancelled — ${fmt(appt.start_time)}`;
  const text =
    `Hi ${appt.patient_name},\n\n` +
    `Your appointment on ${fmt(appt.start_time)} with ${appt.dentist_name} ` +
    `has been cancelled.\n\n` +
    `Would you like to rebook? Call us at ${config.clinic.phone}.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    badge: 'Cancelled',
    badgeBg: '#fee2e2',
    badgeColor: '#dc2626',
    heading: 'Your appointment was cancelled',
    intro: `Your appointment on ${fmt(appt.start_time)} with ${appt.dentist_name} has been cancelled.`,
    rows: [
      ['When', fmt(appt.start_time)],
      ['Dentist', appt.dentist_name],
    ],
    closing: `Would you like to rebook? Call us at ${config.clinic.phone}.`,
  });
  return { subject, text, html };
}

export function bookingSms(appt) {
  return (
    `${config.clinic.name}: Hi ${firstName(appt.patient_name)}, your appointment with ` +
    `${appt.dentist_name} is confirmed for ${fmt(appt.start_time)}. ` +
    `Reschedule/cancel: ${config.clinic.phone}`
  );
}

export function cancellationSms(appt) {
  return (
    `${config.clinic.name}: Hi ${firstName(appt.patient_name)}, your appointment on ` +
    `${fmt(appt.start_time)} with ${appt.dentist_name} was cancelled. ` +
    `Rebook: ${config.clinic.phone}`
  );
}

export function followUpSms(appt) {
  return (
    `${config.clinic.name}: Hi ${firstName(appt.patient_name)}, your follow-up with ` +
    `${appt.dentist_name} is scheduled for ${fmt(appt.start_time)}. See you then!`
  );
}

export function followUpTemplate(appt) {
  const subject = `Follow-up appointment booked — ${fmt(appt.start_time)}`;
  const text =
    `Hi ${appt.patient_name},\n\n` +
    `We've scheduled your follow-up visit at ${config.clinic.name}.\n\n` +
    `  When:    ${fmt(appt.start_time)}\n` +
    `  Dentist: ${appt.dentist_name}\n\n` +
    `See you then,\n${config.clinic.name}`;
  const html = renderEmail({
    badge: 'Follow-up booked',
    badgeBg: '#e0e7ff',
    badgeColor: '#4f46e5',
    heading: 'Your follow-up visit is scheduled',
    intro: `We've scheduled your follow-up visit at ${config.clinic.name}.`,
    rows: [
      ['When', fmt(appt.start_time)],
      ['Dentist', appt.dentist_name],
    ],
    closing: 'See you then!',
  });
  return { subject, text, html };
}
