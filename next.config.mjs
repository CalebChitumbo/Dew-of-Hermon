/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverComponentsExternalPackages: ["firebase-admin"],
};

export default nextConfig;
