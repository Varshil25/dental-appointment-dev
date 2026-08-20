/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — matches the existing frontend/'s deployment model
  // (free static hosting on Render, gateway reverse-proxies /api/*).
  // `rewrites()` is NOT supported in this mode — see lib/api.js for how
  // the /api proxy is instead handled per-environment without one.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
