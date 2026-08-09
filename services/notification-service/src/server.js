import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import sendRoute from './routes/send.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification-service' }));

app.use('/internal', sendRoute);

app.use((err, _req, res, _next) => {
  console.error('[notification-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[notification-service] listening on http://localhost:${config.port}`);
});
