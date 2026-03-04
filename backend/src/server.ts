import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { taskManager } from './shared/task-manager.js';
import { closeBrowser } from './shared/browser.js';
import pageDiffPlugin from './tools/page-diff/index.js';
import deadLinkCheckerPlugin from './tools/dead-link-checker/index.js';
import migrationTrackerPlugin from './tools/migration-tracker/index.js';

const fastify = Fastify({ logger: true });

async function start() {
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  fastify.register(async function wsRoutes(app) {
    app.get('/ws/:taskId', { websocket: true }, (socket, req) => {
      const { taskId } = req.params as { taskId: string };
      taskManager.subscribe(taskId, socket);
    });
  });

  await fastify.register(pageDiffPlugin, { prefix: '/api/tools/page-diff' });
  await fastify.register(deadLinkCheckerPlugin, { prefix: '/api/tools/dead-link-checker' });
  await fastify.register(migrationTrackerPlugin, { prefix: '/api/tools/migration-tracker' });

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  const shutdown = async () => {
    await closeBrowser();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
