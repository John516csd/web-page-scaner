import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function urlTesterPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
