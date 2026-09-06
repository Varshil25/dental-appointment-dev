import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import sendRoute from './routes/send.js';

const app = express();
app.use(cors());
// Default 100kb is too small once a base64-encoded PDF attachment (invoice
// emails) rides along in the body — 33% larger than the raw file already,
// and a multi-page invoice can run a few hundred KB raw.
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification-service' }));

app.use('/internal', sendRoute);

app.use((err, _req, res, _next) => {
  console.error('[notification-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[notification-service] listening on http://localhost:${config.port}`);
});
