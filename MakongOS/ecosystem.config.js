module.exports = {
  apps: [
    {
      name: 'makongos',
      script: 'dist/server.js',
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
