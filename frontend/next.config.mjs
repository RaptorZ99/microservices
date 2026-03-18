/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
