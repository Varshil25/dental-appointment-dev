import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db.js';
import dentists from './routes/dentists.js';
import internal from './routes/internal.js';
import clinicProfile from './routes/clinicProfile.js';
import inquiries from './routes/inquiries.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'dentist-service' }));

// clinic-profile and inquiries must be mounted before dentists: dentists'
// GET/PUT '/:id' is a single-segment route and would otherwise swallow
// '/clinic-profile' or '/inquiries' (treating either as an :id and
// crashing on the integer cast).
app.use('/internal', internal);
app.use('/clinic-profile', clinicProfile);
app.use('/inquiries', inquiries);
app.use('/', dentists);

app.use((err, _req, res, _next) => {
  console.error('[dentist-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[dentist-service] listening on http://localhost:${config.port}`);
});
