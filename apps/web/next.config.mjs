/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@thecolony/domain', '@thecolony/sim'],
  experimental: {
    optimizePackageImports: ['pixi.js'],
  },
};

export default nextConfig;
