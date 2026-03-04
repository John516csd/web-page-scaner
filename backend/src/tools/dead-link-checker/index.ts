import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function deadLinkCheckerPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
