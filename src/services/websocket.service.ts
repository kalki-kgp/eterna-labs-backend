import { WebSocket } from 'ws';
import { OrderStatusUpdate } from '../types/order.types';
import { logger } from '../utils/logger';

/**
 * WebSocket Manager Service
 * Manages WebSocket connections and broadcasts order status updates
 */
export class WebSocketManager {
  private connections: Map<string, WebSocket>;

  constructor() {
    this.connections = new Map();
  }

  /**
   * Registers a WebSocket connection for an order
   */
  register(orderId: string, ws: WebSocket): void {
    this.connections.set(orderId, ws);

    ws.on('close', () => {
      this.connections.delete(orderId);
      logger.info({ orderId }, 'WebSocket connection closed');
    });

    ws.on('error', (error) => {
      logger.error({ error, orderId }, 'WebSocket error');
      this.connections.delete(orderId);
    });

    logger.info({ orderId }, 'WebSocket connection registered');
  }

  /**
   * Sends a status update to the connected client
   */
  sendUpdate(update: OrderStatusUpdate): void {
    const ws = this.connections.get(update.orderId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn({ orderId: update.orderId }, 'WebSocket not open, skipping update');
      return;
    }

    try {
      ws.send(JSON.stringify(update));
      logger.debug({ orderId: update.orderId, status: update.status }, 'Status update sent');
    } catch (error) {
      logger.error({ error, orderId: update.orderId }, 'Failed to send WebSocket update');
    }
  }

  /**
   * Closes a WebSocket connection
   */
  close(orderId: string): void {
    const ws = this.connections.get(orderId);
    if (ws) {
      ws.close();
      this.connections.delete(orderId);
      logger.info({ orderId }, 'WebSocket connection closed manually');
    }
  }

  /**
   * Gets the number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Closes all connections
   */
  closeAll(): void {
    this.connections.forEach((ws, orderId) => {
      ws.close();
      logger.info({ orderId }, 'WebSocket connection closed (shutdown)');
    });
    this.connections.clear();
  }
}

export const wsManager = new WebSocketManager();
