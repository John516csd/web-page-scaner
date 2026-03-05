import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function redirectTesterPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
