/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/pipeline',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/pipeline/:path*',
        destination: '/contact/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
