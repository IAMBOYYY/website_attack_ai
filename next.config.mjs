/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
