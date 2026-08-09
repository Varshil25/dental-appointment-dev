import PDFDocument from 'pdfkit';

const BRAND = '#0f766e'; // matches the email templates' brand teal
const MUTED = '#6b7280';
const INK = '#111827';
const BORDER = '#e5e7eb';

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// Minimal manual table layout — pdfkit has no built-in table support.
// `cols` is [{ header, width, align }], `rows` is an array of arrays of cell strings.
function drawTable(doc, { x, y, cols, rows }) {
  const rowHeight = 20;
  let cursorY = y;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED);
  let cx = x;
  for (const col of cols) {
    doc.text(col.header.toUpperCase(), cx, cursorY, { width: col.width, align: col.align || 'left' });
    cx += col.width;
  }
  cursorY += 14;
  doc.moveTo(x, cursorY).lineTo(x + cols.reduce((s, c) => s + c.width, 0), cursorY).strokeColor(BORDER).stroke();
  cursorY += 6;

  doc.font('Helvetica').fontSize(10).fillColor(INK);
  for (const row of rows) {
    cx = x;
    for (let i = 0; i < cols.length; i++) {
      doc.text(String(row[i]), cx, cursorY, { width: cols[i].width, align: cols[i].align || 'left' });
      cx += cols[i].width;
    }
    cursorY += rowHeight;
  }
  return cursorY;
}

function statLine(doc, x, y, label, value) {
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, x, y, { width: 160 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(String(value), x, y + 13, { width: 160 });
}

const STATUS_LABELS = { booked: 'Booked', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };

// Streams a formatted clinic report PDF directly to the HTTP response.
export function renderSummaryPdf(res, summary, { clinic, from, to }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  const filename = `clinic-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND).text(clinic.name);
  doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Clinic Report');

  const rangeText = from || to
    ? `Period: ${from ? fmtDate(from) : 'earliest'} – ${to ? fmtDate(to) : 'latest'}`
    : 'Period: all time';
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor(MUTED).text(rangeText);
  doc.text(`Generated ${new Date().toLocaleString('en-US')}`);

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1.2);

  // ── Summary stats (2x3 grid) ────────────────────────────
  const statY = doc.y;
  const col1 = 50, col2 = 220, col3 = 390;
  statLine(doc, col1, statY, 'Total appointments', summary.total);
  statLine(doc, col2, statY, 'Upcoming', summary.upcoming);
  statLine(doc, col3, statY, 'Patients on file', summary.patients);
  statLine(doc, col1, statY + 40, 'No-show rate', `${summary.noShowRate}%`);
  statLine(doc, col2, statY + 40, 'Cancellation rate', `${summary.cancellationRate}%`);
  statLine(doc, col3, statY + 40, 'Reminders sent', summary.remindersSent);
  doc.y = statY + 70;

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1.2);

  // ── Appointments by status ──────────────────────────────
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Appointments by status');
  doc.moveDown(0.5);
  const statusRows = Object.entries(summary.counts).map(([status, n]) => [
    STATUS_LABELS[status] || status,
    n,
    summary.total ? `${((n / summary.total) * 100).toFixed(1)}%` : '0%',
  ]);
  const afterStatusY = drawTable(doc, {
    x: 50,
    y: doc.y,
    cols: [
      { header: 'Status', width: 200 },
      { header: 'Count', width: 100, align: 'right' },
      { header: 'Share', width: 100, align: 'right' },
    ],
    rows: statusRows,
  });
  doc.y = afterStatusY + 15;

  // ── Dentist load ─────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Dentist load');
  doc.moveDown(0.5);
  const dentistRows = summary.perDentist.map((d) => [d.name, d.kept || 0, d.no_shows || 0, d.cancelled || 0]);
  const afterDentistY = drawTable(doc, {
    x: 50,
    y: doc.y,
    cols: [
      { header: 'Dentist', width: 220 },
      { header: 'Kept', width: 90, align: 'right' },
      { header: 'No-shows', width: 90, align: 'right' },
      { header: 'Cancelled', width: 100, align: 'right' },
    ],
    rows: dentistRows,
  });
  doc.y = afterDentistY;

  // ── Footer ───────────────────────────────────────────────
  doc.fontSize(8).fillColor(MUTED).text(
    `${clinic.name} · ${clinic.phone} · ${clinic.address}`,
    50,
    780,
    { width: 495, align: 'center' }
  );

  doc.end();
}
