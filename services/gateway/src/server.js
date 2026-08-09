import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { mountProxies } from './proxyRoutes.js';
import { aggregatedHealth } from './health.js';
import { mountDocs } from './docs.js';

const app = express();
app.use(cors());

// Registered before the proxies below so it's answered by the gateway
// itself rather than forwarded anywhere.
app.get('/api/health', aggregatedHealth);
mountDocs(app);

mountProxies(app);

app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.listen(config.port, () => {
  console.log(`\n🦷  Gateway listening on http://localhost:${config.port}`);
  console.log(`    API docs at http://localhost:${config.port}/api-docs`);
});
