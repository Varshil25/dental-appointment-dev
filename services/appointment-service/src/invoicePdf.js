import PDFDocument from 'pdfkit';

// Same palette as report-service's pdf.js, kept in sync with the email
// templates' brand teal so a clinic's PDFs look like one system.
const BRAND = '#0f766e';
const MUTED = '#6b7280';
const INK = '#111827';
const BORDER = '#e5e7eb';

const STATUS_LABELS = { unpaid: 'Unpaid', paid: 'Paid', cancelled: 'Cancelled' };

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const fmtMoney = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : '—');

// Minimal manual table layout — pdfkit has no built-in table support, same
// approach as report-service/src/pdf.js's drawTable.
function drawLineItems(doc, x, y, items) {
  const width = 495;
  const descWidth = 355;
  const amountWidth = 140;
  let cursorY = y;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED);
  doc.text('DESCRIPTION', x, cursorY, { width: descWidth });
  doc.text('AMOUNT', x + descWidth, cursorY, { width: amountWidth, align: 'right' });
  cursorY += 14;
  doc.moveTo(x, cursorY).lineTo(x + width, cursorY).strokeColor(BORDER).stroke();
  cursorY += 8;

  doc.font('Helvetica').fontSize(10).fillColor(INK);
  for (const item of items || []) {
    const before = cursorY;
    doc.text(item.description, x, cursorY, { width: descWidth });
    const descHeight = doc.heightOfString(item.description, { width: descWidth });
    doc.text(fmtMoney(item.amount), x + descWidth, before, { width: amountWidth, align: 'right' });
    cursorY = before + Math.max(descHeight, 14) + 6;
  }
  return cursorY;
}

function totalLine(doc, x, y, label, value, { bold = false } = {}) {
  const width = 495;
  const labelWidth = 395;
  const amountWidth = 100;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(bold ? INK : MUTED);
  doc.text(label, x + width - labelWidth - amountWidth, y, { width: labelWidth, align: 'right' });
  doc.text(value, x + width - amountWidth, y, { width: amountWidth, align: 'right' });
}

// Streams a formatted invoice PDF directly to the HTTP response. `clinic`
// is the composed clinic-profile row (or null if that lookup failed — the
// header falls back to a generic label rather than failing the download).
export function renderInvoicePdf(res, invoice, clinic) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}.pdf"`);
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND).text(clinic?.clinic_name || 'Invoice');
  if (clinic?.address || clinic?.phone) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text([clinic.address, clinic.phone].filter(Boolean).join(' · '));
  }

  doc.moveUp(clinic?.address || clinic?.phone ? 2 : 1);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(`INVOICE #${invoice.id}`, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Issued ${fmtDate(invoice.created_at)}`, { align: 'right' });
  doc.text(STATUS_LABELS[invoice.status] || invoice.status, { align: 'right' });

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1);

  // ── Bill to / dentist ─────────────────────────────────────
  const infoY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('BILL TO', 50, infoY);
  doc.font('Helvetica').fontSize(11).fillColor(INK).text(invoice.patient_name || `Patient #${invoice.patient_id}`, 50, infoY + 14);
  if (invoice.patient_email) doc.fontSize(9).fillColor(MUTED).text(invoice.patient_email);
  if (invoice.patient_phone) doc.fontSize(9).fillColor(MUTED).text(invoice.patient_phone);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('DENTIST', 320, infoY);
  doc.font('Helvetica').fontSize(11).fillColor(INK).text(invoice.dentist_name || `Dentist #${invoice.dentist_id}`, 320, infoY + 14);

  doc.y = Math.max(doc.y, infoY + 70);

  // ── Line items ───────────────────────────────────────────
  const afterItemsY = drawLineItems(doc, 50, doc.y, invoice.line_items);
  doc.y = afterItemsY + 6;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(0.8);

  totalLine(doc, 50, doc.y, 'Subtotal', fmtMoney(invoice.subtotal));
  doc.moveDown(0.6);
  totalLine(doc, 50, doc.y, 'Tax', fmtMoney(invoice.tax));
  doc.moveDown(0.6);
  totalLine(doc, 50, doc.y, 'Total', fmtMoney(invoice.total), { bold: true });
  doc.moveDown(1.5);

  // ── Payment status ───────────────────────────────────────
  // Every call below passes x=50/width=495 explicitly rather than relying
  // on doc's internal cursor — totalLine()'s last call leaves that cursor
  // parked in its narrow right-aligned amount column (~100pt wide), which
  // wraps anything text()'d afterward without an explicit width.
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1);
  if (invoice.status === 'paid') {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(
      `Paid ${fmtDate(invoice.paid_at)}${invoice.payment_method ? ` · ${invoice.payment_method}` : ''}`,
      50, doc.y, { width: 495 }
    );
  } else {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(STATUS_LABELS[invoice.status] || invoice.status, 50, doc.y, { width: 495 });
  }

  if (invoice.notes) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('NOTES', 50, doc.y, { width: 495 });
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(invoice.notes, 50, doc.y, { width: 495 });
  }

  // This is a record of a payment taken in person (cash/card/insurance at
  // the desk) or otherwise arranged outside this system — never an online
  // payment receipt, so the footer says so explicitly rather than implying
  // this document itself processed anything.
  doc.fontSize(8).fillColor(MUTED).text(
    'This invoice does not process payment online. It records a payment taken in person or arranged directly with the clinic.',
    50,
    780,
    { width: 495, align: 'center' }
  );

  doc.end();
}
