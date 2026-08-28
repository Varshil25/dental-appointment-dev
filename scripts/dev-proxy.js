// Local reverse proxy so the whole app is reachable from a single origin
// (http://localhost:3000) in dev, mirroring render.yaml's path-based
// routing in production: /v1/admin/* -> admin dashboard (frontend/, run
// on internal port 3002 via its `dev:internal` script), everything else ->
// patient-frontend (internal port 3003, same). Run via `npm run dev:all`
// at the repo root — see that script for how all three processes start
// together.
//
// Plain `http-proxy` rather than `http-proxy-middleware`: no framework
// (Express/Connect) is otherwise in this project, and http-proxy exposes
// both .web() and .ws() directly against Node's built-in http server,
// which is all this needs.
import http from 'node:http';
import httpProxy from 'http-proxy';

const PORT = process.env.PROXY_PORT || 3000;
const ADMIN_TARGET = process.env.ADMIN_TARGET || 'http://localhost:3002';
const PATIENT_TARGET = process.env.PATIENT_TARGET || 'http://localhost:3003';

const proxy = httpProxy.createProxyServer({ ws: true });
proxy.on('error', (err, req, res) => {
  console.error('[dev-proxy] proxy error:', err.message);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway — is the target dev server running yet?');
  }
});

function targetFor(req) {
  return req.url.startsWith('/v1/admin') ? ADMIN_TARGET : PATIENT_TARGET;
}

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: targetFor(req) });
});

// Next.js dev server HMR runs over a websocket — must be proxied too, or
// the proxied app falls back to full page reloads instead of fast refresh.
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: targetFor(req) });
});

server.listen(PORT, () => {
  console.log(`[dev-proxy] listening on http://localhost:${PORT}`);
  console.log(`[dev-proxy]   /v1/admin/* -> ${ADMIN_TARGET}`);
  console.log(`[dev-proxy]   /*          -> ${PATIENT_TARGET}`);
});
