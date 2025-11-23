import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Order, OrderType, OrderStatus, CreateOrderRequest } from '../types/order.types';
import { orderModel } from '../models/order.model';
import { orderQueueService } from '../services/queue.service';
import { orderExecutionService } from '../services/orderExecution.service';
import { wsManager } from '../services/websocket.service';
import { logger } from '../utils/logger';

// Zod schema for request validation
const createOrderSchema = z.object({
  type: z.nativeEnum(OrderType),
  tokenIn: z.string().min(1).max(44),
  tokenOut: z.string().min(1).max(44),
  amountIn: z.number().positive(),
  slippage: z.number().min(0).max(0.5).optional().default(0.01),
});

export async function orderRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/orders/execute
   * Creates and executes an order with WebSocket upgrade
   */
  fastify.post(
    '/execute',
    {
      websocket: true,
    },
    async (socket, req: FastifyRequest) => {
      try {
        // Parse and validate request body
        const body = req.body as CreateOrderRequest;
        const validationResult = createOrderSchema.safeParse(body);

        if (!validationResult.success) {
          socket.send(
            JSON.stringify({
              error: 'Validation failed',
              details: validationResult.error.errors,
            })
          );
          socket.close();
          return;
        }

        const orderData = validationResult.data;

        // Additional business validation
        const validation = orderExecutionService.validateOrder(orderData);
        if (!validation.valid) {
          socket.send(
            JSON.stringify({
              error: 'Order validation failed',
              details: validation.errors,
            })
          );
          socket.close();
          return;
        }

        // Create order
        const order: Order = {
          orderId: uuidv4(),
          type: orderData.type,
          tokenIn: orderData.tokenIn,
          tokenOut: orderData.tokenOut,
          amountIn: orderData.amountIn,
          slippage: orderData.slippage,
          status: OrderStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          retryCount: 0,
        };

        // Save to database
        await orderModel.create(order);

        // Register WebSocket connection
        wsManager.register(order.orderId, socket);

        // Send initial response with orderId
        socket.send(
          JSON.stringify({
            orderId: order.orderId,
            message: 'Order created successfully',
            status: OrderStatus.PENDING,
          })
        );

        // Add to queue for processing
        await orderQueueService.addOrder(order);

        logger.info({ orderId: order.orderId }, 'Order created and queued');
      } catch (error) {
        logger.error({ error }, 'Failed to create order');
        socket.send(
          JSON.stringify({
            error: 'Failed to create order',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        );
        socket.close();
      }
    }
  );

  /**
   * GET /api/orders/:orderId
   * Retrieves order details by ID
   */
  fastify.get('/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = request.params as { orderId: string };

    try {
      const order = await orderModel.getById(orderId);

      if (!order) {
        return reply.status(404).send({
          error: 'Order not found',
          orderId,
        });
      }

      return reply.send(order);
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to retrieve order');
      return reply.status(500).send({
        error: 'Failed to retrieve order',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/orders
   * Retrieves all orders with optional filtering
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: OrderStatus;
      limit?: number;
      offset?: number;
    };

    try {
      const orders = await orderModel.getAll({
        status,
        limit: Number(limit),
        offset: Number(offset),
      });

      return reply.send({
        orders,
        count: orders.length,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve orders');
      return reply.status(500).send({
        error: 'Failed to retrieve orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/orders/queue/metrics
   * Retrieves queue metrics
   */
  fastify.get('/queue/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await orderQueueService.getMetrics();
      const wsConnections = wsManager.getConnectionCount();

      return reply.send({
        queue: metrics,
        websocket: {
          activeConnections: wsConnections,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve queue metrics');
      return reply.status(500).send({
        error: 'Failed to retrieve queue metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
