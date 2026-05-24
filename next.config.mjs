/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "out",
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: process.env.NODE_ENV === "production" ? "./" : undefined,
  // Source maps reveal full source + LLM prompts to anyone who unpacks the
  // app. Build server-side and upload to Sentry/etc. if you need them.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
