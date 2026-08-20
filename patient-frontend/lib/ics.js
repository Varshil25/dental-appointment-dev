// Minimal .ics generator for the "Add to calendar" download on the booking
// confirmation page — no backend involvement needed, this is pure client
// formatting of data we already have from the booking response.
function toICSDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICS(s) {
  return String(s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
}

export function buildAppointmentICS(appt, clinic) {
  const now = toICSDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//' + (clinic?.clinic_name || 'Dental Clinic') + '//Booking//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:appointment-${appt.id}@${(clinic?.clinic_name || 'clinic').replace(/\s+/g, '-').toLowerCase()}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(appt.start_time)}`,
    `DTEND:${toICSDate(appt.end_time)}`,
    `SUMMARY:${escapeICS(`Dental appointment — ${appt.dentist_name}`)}`,
    `DESCRIPTION:${escapeICS(
      `Reason: ${appt.reason || 'General visit'}\nDentist: ${appt.dentist_name}\nReference: #${appt.id}`
    )}`,
    clinic?.address ? `LOCATION:${escapeICS(clinic.address)}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadICS(appt, clinic) {
  const blob = new Blob([buildAppointmentICS(appt, clinic)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appointment-${appt.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
