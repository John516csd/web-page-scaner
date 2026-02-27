import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function pageDiffPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
