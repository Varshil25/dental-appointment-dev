import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db.js';
import { startReminderScheduler } from './reminders.js';
import reminders from './routes/reminders.js';
import internal from './routes/internal.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'reminder-service', reminderOffsetsHours: config.reminderOffsetsHours })
);

app.use('/', reminders);
app.use('/internal', internal);

app.use((err, _req, res, _next) => {
  console.error('[reminder-service] unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`[reminder-service] listening on http://localhost:${config.port}`);
  startReminderScheduler();
});
