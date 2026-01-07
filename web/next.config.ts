import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.eu-central-1.amazonaws.com',
        pathname: '/immomio-**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'immomio-*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.immomio.com',
      },
    ],
  },
};

export default nextConfig;
