/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — keeps this a free static site on Render (matching the
  // old Vite build's deployment), same as the rest of this Blueprint's
  // cost model. `rewrites()` is NOT supported in this mode (Next.js errors
  // even in `next dev` if you define one) — see lib/api.js for how the
  // /api proxy is instead handled per-environment without one.
  output: 'export',
  // This app is served under /v1/admin — either proxied there from
  // patient-frontend's own origin (render.yaml's rewrite / the local
  // dev-proxy), or hit directly at this service's own Render URL (see
  // render.yaml's routes on the `frontend` service, which translate
  // /v1/admin/* back down to the static export's actual flat output
  // layout). basePath is a build-time value baked into the client bundle
  // — next/link and useRouter apply it automatically to every internal
  // href, so no other code changes are needed. Works the same in
  // `next dev` (which understands basePath directly, no rewrite needed —
  // see scripts/dev-proxy.js) as in the static export build.
  basePath: '/v1/admin',
  // Repo root now has its own package-lock.json (for the dev-proxy's
  // deps), which without this makes Turbopack warn and guess at the
  // workspace root from among the 3 lockfiles present.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
