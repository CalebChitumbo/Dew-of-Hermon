/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["firebase", "@firebase"],
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
