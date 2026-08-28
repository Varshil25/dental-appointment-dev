import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';

// Pure prefix reverse-proxy: /api/<segment>/* -> <that service>/*, no other
// path rewriting. Every service keeps mounting its router exactly like the
// old monolith's `app.use('/api/patients', patients)` did, so the frontend
// (which only knows relative /api/* paths) needs zero changes.
//
// clinic-profile is the one exception: it lives inside dentist-service
// (see dentist-service/src/routes/clinicProfile.js) rather than getting
// its own service, so it can't reuse the '' rewrite the others use — that
// would collide with dentist-service's own '/' (GET/POST /dentists)
// route. It needs a fixed rewrite to '/clinic-profile' instead, matching
// where dentist-service actually mounts that router — see note below on
// why a fixed function (not the `{regex: replacement}` form the other
// routes use) is required to make that actually take effect.
const routeTable = [
  ['/api/patients', config.services.patient, ''],
  ['/api/dentists', config.services.dentist, ''],
  ['/api/appointments', config.services.appointment, ''],
  ['/api/reminders', config.services.reminder, ''],
  ['/api/reports', config.services.report, ''],
  ['/api/clinic-profile', config.services.dentist, () => '/clinic-profile'],
  // Same "fixed prefix" rewrite need as clinic-profile above, but inquiries
  // has sub-paths (e.g. '/:id/status') that must survive the rewrite, so
  // the function form prepends '/inquiries' to whatever Express left in
  // req.url after stripping the '/api/inquiries' mount prefix instead of
  // discarding it outright.
  ['/api/inquiries', config.services.dentist, (path) => `/inquiries${path}`],
  ['/api/auth', config.services.auth, ''],
  // Same "fixed prefix, sub-paths must survive" rewrite need as inquiries
  // above — dentist-applications lives in auth-service (see that service's
  // db.js for why) alongside its own '/' auth routes, so it can't reuse the
  // '' rewrite either.
  ['/api/dentist-applications', config.services.auth, (path) => `/dentist-applications${path}`],
];

export function mountProxies(app) {
  for (const [prefix, target, rewriteTo] of routeTable) {
    app.use(
      prefix,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        // Without these, a downstream service that never responds (a
        // stalled cold start, a wedged connection) leaves the proxied
        // request hanging indefinitely — no error, no timeout, just an
        // open socket forever. proxyTimeout bounds the gateway->target
        // leg; timeout bounds the client->gateway leg so the client socket
        // doesn't itself sit open past that. 55s is generous enough to
        // cover a free-tier cold start chain but still finite.
        proxyTimeout: 55_000,
        timeout: 60_000,
        // Express strips `prefix` from req.url before this middleware ever
        // sees it, so the `{regex: replacement}` form below — whose regex
        // is anchored on that now-absent prefix — never actually matches;
        // it's a harmless no-op for the other routes only because their
        // rewrite target ('') already equals the post-strip path. A route
        // that needs to land on a non-root path (clinic-profile) has to
        // use a rewrite function instead, which runs unconditionally.
        pathRewrite: typeof rewriteTo === 'function' ? rewriteTo : { [`^${prefix}`]: rewriteTo },
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
