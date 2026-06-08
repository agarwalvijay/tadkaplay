// PM2 process definition for Tadka Play (the hub + all mounted games run in
// this single Node process). Behind nginx, proxy your domain to PORT.
//
//   pm2 start ecosystem.config.cjs       # first time
//   pm2 reload ecosystem.config.cjs      # zero-downtime reload (used by CI)
module.exports = {
  apps: [
    {
      name: 'tadkaplay',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',   // single Node process (Socket.IO-friendly)
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // 8080 was taken by another site; point nginx (tadkaplay.com) here.
        PORT: 8123,
      },
    },
  ],
};
