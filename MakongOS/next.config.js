/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'discord.js',
      '@discordjs/ws',
      '@discordjs/rest',
      '@discordjs/voice',
      '@discordjs/builders',
      'zlib-sync',
      'bufferutil',
      'utf-8-validate',
      '@prisma/client'
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'i.mc-server.icu' }
    ]
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
