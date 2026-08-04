/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["firebase", "@firebase"],
  experimental: {
    // exceljs (camp register export) reaches for Node built-ins and dynamic
    // requires that webpack can't follow — leave it to the Node runtime.
    serverComponentsExternalPackages: ["firebase-admin", "exceljs"],
  },
};

export default nextConfig;
