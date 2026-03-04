import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

// Side-effect imports to register task handlers
import './diff-runner.js';
import './ai-analyzer.js';

export default async function migrationTrackerPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
