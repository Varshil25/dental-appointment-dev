import { config } from './config.js';

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

const firstName = (fullName) => (fullName || '').trim().split(' ')[0] || fullName;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Table-based layout with inline styles throughout — the only markup style
// that renders consistently across Gmail/Outlook/Apple Mail, none of which
// can be relied on to support a <style> block or modern CSS layout.
function renderEmail({ icon, accent, accentSoft, badge, heading, intro, rows, closing, ctaLabel, ctaHref, footerNote }) {
  const { name, phone, address } = config.clinic;

  const rowItem = ([label, value, rowIcon]) => `
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="34" valign="top" style="width:34px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;border-radius:8px;background:${accentSoft};font-size:13px;line-height:28px;text-align:center;">${rowIcon || '&bull;'}</td>
                  </tr></table>
                </td>
                <td style="padding-left:10px;" valign="middle">
                  <div style="font-size:10.5px;font-weight:700;color:#9aa1ac;text-transform:uppercase;letter-spacing:.05em;line-height:1.4;">${escapeHtml(label)}</div>
                  <div style="font-size:14.5px;font-weight:600;color:#0f172a;line-height:1.4;">${escapeHtml(value)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

  const divider = `
        <tr>
          <td style="padding:12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td height="1" style="font-size:1px;line-height:1px;background-color:#e9ecf0;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>`;

  const rowsHtml = rows.map(rowItem).join(divider);

  // ctaHref (an ordinary link, e.g. the review page) takes priority over
  // the default "Call the clinic" tel: link most other templates use.
  const telHref = phone ? `tel:${String(phone).replace(/[^+\d]/g, '')}` : null;
  const href = ctaHref || telHref;
  const cta = ctaLabel && href
    ? `
        <tr>
          <td style="padding:26px 0 0;text-align:center;">
            <a href="${href}" style="display:inline-block;background:${accent};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:12px 30px;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>`
    : '';

  return `
<div style="background:#eef1f5;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;">
    <tr>
      <td style="text-align:center;padding-bottom:22px;">
        <span style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#98a2b3;">&#129688;&nbsp; ${escapeHtml(name)}</span>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-radius:18px;box-shadow:0 10px 34px rgba(15,23,42,.08);overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td height="5" style="font-size:0;line-height:0;background-color:${accent};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:38px 36px 6px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px;">
                <tr>
                  <td width="54" height="54" align="center" valign="middle" style="width:54px;height:54px;border-radius:50%;background:${accentSoft};font-size:22px;font-weight:800;color:${accent};line-height:54px;text-align:center;">${icon}</td>
                </tr>
              </table>
              <div>
                <span style="display:inline-block;padding:5px 13px;border-radius:999px;background:${accentSoft};color:${accent};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;">${escapeHtml(badge)}</span>
              </div>
              <h1 style="font-size:20px;line-height:1.35;margin:14px 0 8px;color:#0f172a;font-weight:800;">${escapeHtml(heading)}</h1>
              <p style="font-size:14px;line-height:1.6;color:#667085;margin:0 auto;max-width:340px;">${escapeHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border:1px solid #eef0f3;border-radius:14px;">
                <tr>
                  <td style="padding:18px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${rowsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 36px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${cta}
                <tr>
                  <td style="padding:${cta ? '14' : '22'}px 0 0;">
                    <p style="font-size:12.5px;line-height:1.6;color:#98a2b3;margin:0;">${escapeHtml(closing)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 12px 0;text-align:center;">
        <p style="font-size:11.5px;color:#a1a8b3;margin:0;line-height:1.6;">${escapeHtml(name)} &middot; ${escapeHtml(phone)} &middot; ${escapeHtml(address)}</p>
        <p style="font-size:10.5px;color:#b7bec8;margin:6px 0 0;line-height:1.6;">${escapeHtml(footerNote || `You're receiving this email because you have an appointment with ${name}.`)}</p>
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
    `Thank you,\n${config.clinic.name}\n\n` +
    `---\nYou're receiving this email because you have an appointment with ${config.clinic.name}.`;
  const html = renderEmail({
    icon: '&#10003;',
    accent: '#059669',
    accentSoft: '#ecfdf5',
    badge: 'Confirmed',
    heading: `You're booked, ${firstName(appt.patient_name)}`,
    intro: `Your appointment at ${config.clinic.name} is confirmed. We'll send you a reminder before your visit.`,
    rows: [
      ['When', fmt(appt.start_time), '&#128197;'],
      ['Dentist', appt.dentist_name, '&#129688;'],
      ['Reason', appt.reason || 'General visit', '&#128221;'],
    ],
    closing: "We'll email you a reminder as your visit gets closer.",
    ctaLabel: 'Call to Reschedule',
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
    `${config.clinic.name}\n\n` +
    `---\nYou're receiving this email because you had an appointment with ${config.clinic.name}.`;
  const html = renderEmail({
    icon: '&#10005;',
    accent: '#e11d48',
    accentSoft: '#fff1f2',
    badge: 'Cancelled',
    heading: 'Your appointment was cancelled',
    intro: `Your appointment on ${fmt(appt.start_time)} with ${appt.dentist_name} has been cancelled.`,
    rows: [
      ['When', fmt(appt.start_time), '&#128197;'],
      ['Dentist', appt.dentist_name, '&#129688;'],
    ],
    closing: 'We hope to see you again soon.',
    ctaLabel: 'Call to Rebook',
  });
  return { subject, text, html };
}

const fmtMoney = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : '—');

export function invoiceEmailTemplate(invoice) {
  const subject = `Your invoice from ${config.clinic.name} — ${fmtMoney(invoice.total)}`;
  const text =
    `Hi ${invoice.patient_name || 'there'},\n\n` +
    `Here is your invoice from ${config.clinic.name} for your recent visit with ${invoice.dentist_name || 'us'}.\n\n` +
    `  Invoice:  #${invoice.id}\n` +
    `  Total:    ${fmtMoney(invoice.total)}\n\n` +
    `The full itemized invoice is attached as a PDF.\n\n` +
    `Questions about this invoice? Call us at ${config.clinic.phone}.\n\n` +
    `Thank you,\n${config.clinic.name}\n\n` +
    `---\nYou're receiving this email because you have an invoice with ${config.clinic.name}.`;
  const html = renderEmail({
    icon: '&#128179;',
    accent: '#0f766e',
    accentSoft: '#f0fdfa',
    badge: 'Invoice',
    heading: `Your invoice, ${firstName(invoice.patient_name)}`,
    intro: `Here's your invoice from ${config.clinic.name}. The full itemized breakdown is attached as a PDF.`,
    rows: [
      ['Invoice', `#${invoice.id}`, '&#128196;'],
      ['Dentist', invoice.dentist_name || 'Our team', '&#129688;'],
      ['Total', fmtMoney(invoice.total), '&#128179;'],
    ],
    closing: 'This email does not process payment — it only shares the invoice for your records.',
    ctaLabel: 'Call with Questions',
    footerNote: `You're receiving this email because you have an invoice with ${config.clinic.name}.`,
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
    `See you then,\n${config.clinic.name}\n\n` +
    `---\nYou're receiving this email because you have an appointment with ${config.clinic.name}.`;
  const html = renderEmail({
    icon: '&#43;',
    accent: '#4f46e5',
    accentSoft: '#eef2ff',
    badge: 'Follow-up booked',
    heading: 'Your follow-up visit is scheduled',
    intro: `We've scheduled your follow-up visit at ${config.clinic.name}.`,
    rows: [
      ['When', fmt(appt.start_time), '&#128197;'],
      ['Dentist', appt.dentist_name, '&#129688;'],
    ],
    closing: 'See you then!',
    ctaLabel: 'Call the Clinic',
  });
  return { subject, text, html };
}

export function reviewRequestTemplate(appt) {
  const reviewUrl = `${config.patientFrontendUrl}/review?appointment=${appt.id}`;
  const subject = `How was your visit with ${appt.dentist_name}?`;
  const text =
    `Hi ${appt.patient_name},\n\n` +
    `Thanks for visiting ${config.clinic.name} on ${fmt(appt.start_time)}. ` +
    `We'd love to hear how it went with ${appt.dentist_name}.\n\n` +
    `Leave a quick rating and review here (no account needed):\n${reviewUrl}\n\n` +
    `Thank you,\n${config.clinic.name}\n\n` +
    `---\nYou're receiving this email because you had an appointment with ${config.clinic.name}.`;
  const html = renderEmail({
    icon: '&#11088;',
    accent: '#d97706',
    accentSoft: '#fffbeb',
    badge: 'Tell us how it went',
    heading: `How was your visit, ${firstName(appt.patient_name)}?`,
    intro: `We'd love to hear about your visit with ${appt.dentist_name} on ${fmt(appt.start_time)}.`,
    rows: [
      ['Dentist', appt.dentist_name, '&#129688;'],
      ['Visit date', fmt(appt.start_time), '&#128197;'],
    ],
    closing: 'Takes less than a minute — no account or login needed.',
    ctaLabel: 'Leave a Review',
    ctaHref: reviewUrl,
    footerNote: `You're receiving this email because you had an appointment with ${config.clinic.name}.`,
  });
  return { subject, text, html };
}

export function reviewRequestSms(appt) {
  const reviewUrl = `${config.patientFrontendUrl}/review?appointment=${appt.id}`;
  return (
    `${config.clinic.name}: Hi ${firstName(appt.patient_name)}, how was your visit with ` +
    `${appt.dentist_name}? Leave a quick review: ${reviewUrl}`
  );
}
