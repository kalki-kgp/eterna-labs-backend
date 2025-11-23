import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { database } from '../utils/database';
import { orderQueueService } from '../services/queue.service';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/health
   * Health check endpoint
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /api/health/detailed
   * Detailed health check with database and queue status
   */
  fastify.get('/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        queue: 'unknown',
      },
    };

    // Check database
    try {
      await database.query('SELECT 1');
      health.services.database = 'ok';
    } catch (error) {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    // Check queue
    try {
      await orderQueueService.getMetrics();
      health.services.queue = 'ok';
    } catch (error) {
      health.services.queue = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });
}
