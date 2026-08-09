/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — keeps this a free static site on Render (matching the
  // old Vite build's deployment), same as the rest of this Blueprint's
  // cost model. `rewrites()` is NOT supported in this mode (Next.js errors
  // even in `next dev` if you define one) — see lib/api.js for how the
  // /api proxy is instead handled per-environment without one.
  output: 'export',
};

export default nextConfig;
