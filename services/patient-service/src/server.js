import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db.js';
import patients from './routes/patients.js';
import internal from './routes/internal.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'patient-service' }));

app.use('/', patients);
app.use('/internal', internal);

app.use((err, _req, res, _next) => {
  console.error('[patient-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[patient-service] listening on http://localhost:${config.port}`);
});
