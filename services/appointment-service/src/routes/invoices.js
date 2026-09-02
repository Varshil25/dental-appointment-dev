import { Router } from 'express';
import { pool } from '../db.js';
import { getAppointmentLocal } from '../queries.js';
import { getInvoiceLocal, getInvoiceByAppointment, listInvoices, getInvoice } from '../invoiceQueries.js';
import { getClinicProfile } from '../clients/dentistServiceClient.js';
import { renderInvoicePdf } from '../invoicePdf.js';
import { invalidateAll } from '../cache.js';

const router = Router();

function validateLineItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    return 'line_items must be a non-empty array of { description, amount }';
  for (const li of items) {
    if (!li || typeof li.description !== 'string' || !li.description.trim())
      return 'each line item needs a non-empty description';
    if (!Number.isFinite(Number(li.amount)) || Number(li.amount) < 0)
      return 'each line item needs a non-negative numeric amount';
  }
  return null;
}

function computeTotals(items, tax) {
  const subtotal = items.reduce((sum, li) => sum + Number(li.amount), 0);
  const taxAmount = Number(tax) || 0;
  return {
    subtotal: +subtotal.toFixed(2),
    tax: +taxAmount.toFixed(2),
    total: +(subtotal + taxAmount).toFixed(2),
  };
}

router.get('/', async (req, res) => {
  res.json(
    await listInvoices({
      status: req.query.status,
      patientId: req.query.patientId,
      dentistId: req.query.dentistId,
      from: req.query.from,
      to: req.query.to,
    })
  );
});

router.get('/:id', async (req, res) => {
  const invoice = await getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'invoice not found' });
  res.json(invoice);
});

// Create an invoice for an appointment. Normally reached from a completed
// appointment in the UI, but not hard-enforced here — an admin wrapping up
// a visit may want to draft the invoice slightly before/after flipping the
// appointment's own status, and there's no real integrity reason to block
// that. What IS enforced: at most one invoice per appointment (also a DB
// UNIQUE constraint — see db.js), so this is the one guard that has to be
// checked here rather than left to the DB to reject.
router.post('/', async (req, res) => {
  const { appointment_id, line_items, tax, notes } = req.body;
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });

  const appt = await getAppointmentLocal(appointment_id);
  if (!appt) return res.status(400).json({ error: 'unknown appointment_id' });

  const existing = await getInvoiceByAppointment(appointment_id);
  if (existing) return res.status(409).json({ error: 'this appointment already has an invoice', invoiceId: existing.id });

  const itemsError = validateLineItems(line_items);
  if (itemsError) return res.status(400).json({ error: itemsError });

  const items = line_items.map((li) => ({ description: li.description.trim(), amount: +Number(li.amount).toFixed(2) }));
  const { subtotal, tax: taxAmount, total } = computeTotals(items, tax);

  const { rows } = await pool.query(
    `INSERT INTO invoices (appointment_id, patient_id, dentist_id, line_items, subtotal, tax, total, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [appt.id, appt.patient_id, appt.dentist_id, JSON.stringify(items), subtotal, taxAmount, total, notes || null]
  );
  await invalidateAll(); // appointment list/detail cache now carries this invoice_id
  res.status(201).json(await getInvoice(rows[0].id));
});

// Admin adds/replaces line items on an invoice that doesn't have real ones
// yet (or wants to correct them) — the counterpart to POST '/' for invoices
// that end up in a bad "no items" state. Only allowed while unpaid: once
// money has changed hands the line items are history, not a draft.
router.patch('/:id/line-items', async (req, res) => {
  const existing = await getInvoiceLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'invoice not found' });
  if (existing.status !== 'unpaid')
    return res.status(400).json({ error: `cannot edit line items on a ${existing.status} invoice` });

  const { line_items, tax } = req.body;
  const itemsError = validateLineItems(line_items);
  if (itemsError) return res.status(400).json({ error: itemsError });

  const items = line_items.map((li) => ({ description: li.description.trim(), amount: +Number(li.amount).toFixed(2) }));
  const { subtotal, tax: taxAmount, total } = computeTotals(items, tax ?? existing.tax);

  await pool.query(
    `UPDATE invoices SET line_items = $1, subtotal = $2, tax = $3, total = $4 WHERE id = $5`,
    [JSON.stringify(items), subtotal, taxAmount, total, existing.id]
  );
  await invalidateAll();
  res.json(await getInvoice(existing.id));
});

// Admin records a payment taken outside this system (cash/card/insurance
// at the desk) — this never charges anything itself, see invoicePdf.js's
// footer and the frontend's dialog copy for the same "not a payment
// gateway" framing.
router.patch('/:id/mark-paid', async (req, res) => {
  const existing = await getInvoiceLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'invoice not found' });
  if (existing.status !== 'unpaid')
    return res.status(400).json({ error: `cannot mark a ${existing.status} invoice as paid` });

  const paymentMethod = String(req.body.payment_method || '').trim();
  if (!paymentMethod) return res.status(400).json({ error: 'payment_method is required' });

  await pool.query(
    `UPDATE invoices SET status = 'paid', payment_method = $1, paid_at = now() WHERE id = $2`,
    [paymentMethod, existing.id]
  );
  await invalidateAll();
  res.json(await getInvoice(existing.id));
});

router.get('/:id/pdf', async (req, res) => {
  const invoice = await getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'invoice not found' });

  let clinic = null;
  try {
    clinic = await getClinicProfile();
  } catch (err) {
    console.error('[appointment-service] could not load clinic profile for invoice pdf:', err.message);
  }
  renderInvoicePdf(res, invoice, clinic);
});

export default router;
