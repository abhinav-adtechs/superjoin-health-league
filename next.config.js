/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prevent bundling of server-only packages that are optionally present.
    // firebase-admin is only needed when FIREBASE_* env vars are configured.
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

module.exports = nextConfig;
