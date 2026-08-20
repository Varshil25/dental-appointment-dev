import { config } from './config.js';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Same table-based, inline-styled layout shape as appointment-service's
// templates.js (the only markup style that renders consistently across
// Gmail/Outlook/Apple Mail) — trimmed down to a single big code/CTA block
// since OTP and reset emails don't need the label/value row list.
function renderEmail({ icon, accent, accentSoft, badge, heading, intro, bigText, closing }) {
  const { name, phone, address } = config.clinic;
  return `
<div style="background:#eef1f5;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
    <tr>
      <td style="text-align:center;padding-bottom:22px;">
        <span style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#98a2b3;">&#129688;&nbsp; ${escapeHtml(name)}</span>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-radius:18px;box-shadow:0 10px 34px rgba(15,23,42,.08);overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td height="5" style="font-size:0;line-height:0;background-color:${accent};">&nbsp;</td></tr>
          <tr>
            <td style="padding:38px 36px 30px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px;">
                <tr><td width="54" height="54" align="center" valign="middle" style="width:54px;height:54px;border-radius:50%;background:${accentSoft};font-size:22px;font-weight:800;color:${accent};line-height:54px;text-align:center;">${icon}</td></tr>
              </table>
              <div><span style="display:inline-block;padding:5px 13px;border-radius:999px;background:${accentSoft};color:${accent};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;">${escapeHtml(badge)}</span></div>
              <h1 style="font-size:20px;line-height:1.35;margin:14px 0 8px;color:#0f172a;font-weight:800;">${escapeHtml(heading)}</h1>
              <p style="font-size:14px;line-height:1.6;color:#667085;margin:0 auto 22px;max-width:360px;">${escapeHtml(intro)}</p>
              <div style="display:inline-block;padding:14px 28px;border-radius:12px;background:#f8f9fb;border:1px solid #eef0f3;font-size:28px;font-weight:800;letter-spacing:.08em;color:#0f172a;">${bigText}</div>
              <p style="font-size:12.5px;line-height:1.6;color:#98a2b3;margin:20px 0 0;">${escapeHtml(closing)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 12px 0;text-align:center;">
        <p style="font-size:11.5px;color:#a1a8b3;margin:0;line-height:1.6;">${escapeHtml(name)} &middot; ${escapeHtml(phone)} &middot; ${escapeHtml(address)}</p>
      </td>
    </tr>
  </table>
</div>`;
}

export function otpEmailTemplate(otp) {
  const subject = `Your ${config.clinic.name} login code: ${otp}`;
  const text =
    `Your login code is ${otp}.\n\n` +
    `It expires in 10 minutes. If you didn't try to log in, you can ignore this email.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    icon: '&#128272;',
    accent: '#4f46e5',
    accentSoft: '#eef2ff',
    badge: 'Login code',
    heading: 'Your one-time code',
    intro: "Enter this code to finish signing in. It expires in 10 minutes.",
    bigText: escapeHtml(otp),
    closing: "Didn't try to log in? You can safely ignore this email.",
  });
  return { subject, text, html };
}

export function applicationReceivedTemplate(application) {
  const subject = `We've received your application — ${config.clinic.name}`;
  const text =
    `Hi ${application.name},\n\n` +
    `Thanks for applying to join ${config.clinic.name} as a dentist. We've received your application ` +
    `and our team will review it shortly — we'll be in touch.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    icon: '&#128221;',
    accent: '#0d9488',
    accentSoft: '#ecfdf5',
    badge: 'Application received',
    heading: "We've received your application",
    intro: `Thanks for applying to join ${config.clinic.name}. Our team will review your application and be in touch soon.`,
    bigText: escapeHtml(application.name),
    closing: 'No action is needed from you right now.',
  });
  return { subject, text, html };
}

export function applicationApprovedTemplate(loginEmail, tempPassword, loginUrl) {
  const subject = `Your application has been approved — you can now sign in`;
  const text =
    `Great news — your application to join ${config.clinic.name} has been approved!\n\n` +
    `You can now sign in to the staff dashboard with:\n` +
    `  Email:               ${loginEmail}\n` +
    `  Temporary password:  ${tempPassword}\n\n` +
    `Sign in here: ${loginUrl}\n\n` +
    `For security, please change your password after signing in — use the "Forgot password?" link ` +
    `on the sign-in page to set a new one.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    icon: '&#127881;',
    accent: '#16a34a',
    accentSoft: '#f0fdf4',
    badge: 'Application approved',
    heading: 'You can now sign in',
    intro: `Your application to join ${config.clinic.name} has been approved. Use the temporary password below to sign in, then change it from the "Forgot password?" link on the sign-in page.`,
    bigText: escapeHtml(tempPassword),
    closing: `Login email: ${loginEmail} · Sign in at ${loginUrl}`,
  });
  return { subject, text, html };
}

export function applicationRejectedTemplate(reason) {
  const subject = `Update on your application — ${config.clinic.name}`;
  const reasonSuffix = reason ? ` ${reason}` : '';
  const text =
    `Thank you for your interest in joining ${config.clinic.name}.\n\n` +
    `After review, we won't be moving forward with your application at this time.${reasonSuffix}\n\n` +
    `We appreciate the time you took to apply and wish you the best.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    icon: '&#128100;',
    accent: '#64748b',
    accentSoft: '#f1f5f9',
    badge: 'Application update',
    heading: 'Thanks for your interest',
    intro: `After review, we won't be moving forward with your application at this time.${reasonSuffix}`,
    bigText: 'We wish you the best',
    closing: 'Thank you for taking the time to apply.',
  });
  return { subject, text, html };
}

export function passwordResetTemplate(resetUrl) {
  const subject = `Reset your ${config.clinic.name} password`;
  const text =
    `We received a request to reset your password.\n\n` +
    `Reset it here (expires in 30 minutes): ${resetUrl}\n\n` +
    `If you didn't request this, you can ignore this email — your password won't change.\n\n` +
    `${config.clinic.name}`;
  const html = renderEmail({
    icon: '&#128273;',
    accent: '#e11d48',
    accentSoft: '#fff1f2',
    badge: 'Password reset',
    heading: 'Reset your password',
    intro: 'We received a request to reset your password. This link expires in 30 minutes.',
    bigText: `<a href="${resetUrl}" style="color:#4f46e5;text-decoration:none;font-size:15px;word-break:break-all;">Reset password</a>`,
    closing: "Didn't request this? You can safely ignore this email — your password won't change.",
  });
  return { subject, text, html };
}
