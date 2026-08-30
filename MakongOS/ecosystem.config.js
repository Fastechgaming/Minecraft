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
    }
  ]
};
