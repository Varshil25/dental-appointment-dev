import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';

// Pure prefix reverse-proxy: /api/<segment>/* -> <that service>/*, no other
// path rewriting. Every service keeps mounting its router exactly like the
// old monolith's `app.use('/api/patients', patients)` did, so the frontend
// (which only knows relative /api/* paths) needs zero changes.
const routeTable = [
  ['/api/patients', config.services.patient],
  ['/api/dentists', config.services.dentist],
  ['/api/appointments', config.services.appointment],
  ['/api/reminders', config.services.reminder],
  ['/api/reports', config.services.report],
];

export function mountProxies(app) {
  for (const [prefix, target] of routeTable) {
    app.use(
      prefix,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^${prefix}`]: '' },
        on: {
          error: (err, _req, res) => {
            console.error(`[gateway] proxy error for ${prefix} -> ${target}:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'upstream service unavailable' }));
          },
        },
      })
    );
  }
}
