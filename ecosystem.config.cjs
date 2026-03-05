module.exports = {
  apps: [
    {
      name: "web-scanner-frontend",
      cwd: "./frontend",
      script: "node_modules/.bin/next",
      args: "start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "web-scanner-backend",
      cwd: "./backend",
      script: "dist/server.js",
      interpreter: "/usr/local/bin/node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
