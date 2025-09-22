/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Enable static optimization
  distDir: 'out',
  // Disable server-side features for static export
  experimental: {
    esmExternals: false,
  },
  // Configure asset prefix for CDN
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
}

export default nextConfig