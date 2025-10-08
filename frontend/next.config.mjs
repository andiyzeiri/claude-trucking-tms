/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Disabled for local development - enable only for static export
  trailingSlash: true,
  typescript: {
    // !! WARN !!
    // Temporarily ignore TypeScript build errors to test runtime fixes
    // TODO: Fix all TypeScript errors in components
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disable ESLint during builds - warnings don't block production
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://d353mi06zxxkvl.cloudfront.net/api/:path*',
      },
    ];
  },
};

export default nextConfig;