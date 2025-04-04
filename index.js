require('dotenv').config();
const server = require('./src/server/server');

async function start() {
  await server.start();
}

start();

process.on('SIGINT', server.shutdown);
process.on('SIGTERM', server.shutdown);

