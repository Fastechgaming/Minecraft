// PM2 runs this file directly with plain node, so — unlike the "makongos" app,
// which loads .env itself via `import 'dotenv/config'` in src/server.ts — the
// "lavalink" app below needs its env vars loaded here to pass them through.
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'makongos',
      // Run through `npm start` (not dist/server.js directly) so the
      // `prisma migrate deploy &&` step baked into that script always runs
      // before the server boots, even under PM2.
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'lavalink',
      // One-time setup before the first start: run scripts/setup-lavalink.sh
      // to download Lavalink.jar (needs Java 17+ installed on the VPS).
      script: 'Lavalink.jar',
      interpreter: 'java',
      interpreter_args: '-jar',
      cwd: './lavalink',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        LAVALINK_PASSWORD: process.env.LAVALINK_PASSWORD,
        YOUTUBE_OAUTH_ENABLED: process.env.YOUTUBE_OAUTH_ENABLED,
        YOUTUBE_REFRESH_TOKEN: process.env.YOUTUBE_REFRESH_TOKEN
      }
    }
  ]
};
