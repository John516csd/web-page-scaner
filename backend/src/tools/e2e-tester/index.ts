import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export default async function e2eTesterPlugin(fastify: FastifyInstance) {
  registerRoutes(fastify);
}
