import { config } from './config.js';

// AbortController alone isn't a reliable upper bound here: aborting a fetch
// that's still mid-DNS-lookup/TLS-handshake against a cold Render free-tier
// instance doesn't always tear the socket down promptly, so a stuck
// downstream service could keep this pending well past the 2s signal.
// Racing against an independent timer guarantees aggregatedHealth() below
// always settles quickly regardless of what the abort actually managed to
// cancel — which matters because this used to be gateway's own Render
// healthCheckPath, and a slow /api/health made Render mark gateway itself
// unhealthy and stop routing traffic to it even though the process was
// fine (see render.yaml — healthCheckPath now points at /api/live instead,
// which never touches a downstream service, but this endpoint still backs
// the admin dashboard's own health view so it needs to stay bounded too).
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, body: null }), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); });
  });
}

async function fetchHealth(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  const attempt = (async () => {
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      if (!res.ok) return { ok: false, body: null };
      return { ok: true, body: await res.json().catch(() => null) };
    } catch {
      return { ok: false, body: null };
    } finally {
      clearTimeout(timeout);
    }
  })();
  return withTimeout(attempt, 3000);
}

export async function aggregatedHealth(_req, res) {
  const entries = Object.entries(config.services);
  const results = await Promise.all(entries.map(([, url]) => fetchHealth(url)));
  const services = Object.fromEntries(entries.map(([name], i) => [name, results[i].ok]));
  const ok = results.every((r) => r.ok);

  // Surfaces reminder-service's configured offsets so the frontend can show
  // "reminders go out 48h/2h before" without needing its own service URL.
  const reminderIdx = entries.findIndex(([name]) => name === 'reminder');
  const reminderOffsetsHours = results[reminderIdx]?.body?.reminderOffsetsHours ?? [];

  res.status(ok ? 200 : 503).json({ ok, clinic: config.clinic, services, reminderOffsetsHours });
}
