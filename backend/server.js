const http = require('http');
const mongoose = require('mongoose');

const app = require('./src/app');
const config = require('./src/config');
const { connectDatabase } = require('./src/config/db');

async function start() {
  await connectDatabase();
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);

  const server = http.createServer(app);
  server.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
