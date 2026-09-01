import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db.js';
import appointments from './routes/appointments.js';
import invoices from './routes/invoices.js';
import internal from './routes/internal.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'appointment-service' }));

// Mounted before appointments: that router's GET '/:id' is a single-segment
// route and would otherwise swallow '/invoices' (treating "invoices" as an
// :id and hitting the DB with an invalid integer) — same ordering fix
// dentist-service uses for clinic-profile vs dentists' '/:id'.
app.use('/invoices', invoices);
app.use('/', appointments);
app.use('/internal', internal);

app.use((err, _req, res, _next) => {
  console.error('[appointment-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[appointment-service] listening on http://localhost:${config.port}`);
});
