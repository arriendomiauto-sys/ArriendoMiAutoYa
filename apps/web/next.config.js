/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: /node_modules|\.git|\.next|[A-Za-z]:[/\\](?:pagefile\.sys|swapfile\.sys|dumpstack\.log\.tmp|System Volume Information)/,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
