module.exports = {
  apps: [
    {
      name: 'server',
      script: 'server.js',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000 // replace 3000 with the desired port
      }
    }
  ]
};
