import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db.js';
import auth from './routes/auth.js';
import internal from './routes/internal.js';
import dentistApplications from './routes/dentistApplications.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'auth-service' }));

// Mounted before '/' auth below: dentist-applications is its own
// self-contained sub-prefix, same shape as '/internal'.
app.use('/internal', internal);
app.use('/dentist-applications', dentistApplications);
app.use('/', auth);

app.use((err, _req, res, _next) => {
  console.error('[auth-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[auth-service] listening on http://localhost:${config.port}`);
});
