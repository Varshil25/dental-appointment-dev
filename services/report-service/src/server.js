import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import reports from './routes/reports.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'report-service' }));

app.use('/', reports);

app.use((err, _req, res, _next) => {
  console.error('[report-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[report-service] listening on http://localhost:${config.port}`);
});
