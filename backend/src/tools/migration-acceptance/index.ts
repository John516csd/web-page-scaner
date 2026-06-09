import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function migrationAcceptancePlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
