import { database } from '../utils/database';
import { Order, OrderStatus, OrderStatusUpdate, DexQuote } from '../types/order.types';
import { logger } from '../utils/logger';

export class OrderModel {
  /**
   * Creates a new order in the database
   */
  async create(order: Order): Promise<Order> {
    const query = `
      INSERT INTO orders (
        order_id, type, token_in, token_out, amount_in, slippage, status, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      order.orderId,
      order.type,
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.slippage,
      order.status,
      order.retryCount || 0,
    ];

    try {
      const result = await database.query(query, values);
      logger.info({ orderId: order.orderId }, 'Order created in database');
      return this.mapRowToOrder(result.rows[0]);
    } catch (error) {
      logger.error({ error, orderId: order.orderId }, 'Failed to create order');
      throw error;
    }
  }

  /**
   * Updates an order's status and optional fields
   */
  async updateStatus(update: OrderStatusUpdate): Promise<void> {
    const { orderId, status, data } = update;

    const query = `
      UPDATE orders
      SET status = $1,
          selected_dex = COALESCE($2, selected_dex),
          executed_price = COALESCE($3, executed_price),
          tx_hash = COALESCE($4, tx_hash),
          error = COALESCE($5, error),
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $6
    `;

    const values = [
      status,
      data?.selectedDex || null,
      data?.executedPrice || null,
      data?.txHash || null,
      data?.error || null,
      orderId,
    ];

    try {
      await database.query(query, values);

      // Log the status update as an event
      await this.logEvent(orderId, status, data);

      logger.info({ orderId, status }, 'Order status updated');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to update order status');
      throw error;
    }
  }

  /**
   * Logs an order event
   */
  async logEvent(orderId: string, status: OrderStatus, data?: unknown): Promise<void> {
    const query = `
      INSERT INTO order_events (order_id, status, data)
      VALUES ($1, $2, $3)
    `;

    const values = [orderId, status, JSON.stringify(data || {})];

    try {
      await database.query(query, values);
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to log order event');
      // Don't throw - logging shouldn't break the flow
    }
  }

  /**
   * Saves DEX quotes for an order
   */
  async saveQuotes(orderId: string, quotes: DexQuote[]): Promise<void> {
    const query = `
      INSERT INTO dex_quotes (order_id, dex, price, amount_out, fee, price_impact)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    try {
      for (const quote of quotes) {
        const values = [
          orderId,
          quote.dex,
          quote.price,
          quote.amountOut,
          quote.fee,
          quote.priceImpact,
        ];
        await database.query(query, values);
      }
      logger.info({ orderId, quoteCount: quotes.length }, 'Quotes saved');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to save quotes');
      // Don't throw - quote saving shouldn't break the flow
    }
  }

  /**
   * Gets an order by ID
   */
  async getById(orderId: string): Promise<Order | null> {
    const query = 'SELECT * FROM orders WHERE order_id = $1';

    try {
      const result = await database.query(query, [orderId]);
      return result.rows.length > 0 ? this.mapRowToOrder(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to get order');
      throw error;
    }
  }

  /**
   * Gets all orders with optional filters
   */
  async getAll(filters?: {
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    let query = 'SELECT * FROM orders';
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (filters?.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(filters.limit);
    }

    if (filters?.offset) {
      query += ` OFFSET $${values.length + 1}`;
      values.push(filters.offset);
    }

    try {
      const result = await database.query(query, values);
      return result.rows.map(this.mapRowToOrder);
    } catch (error) {
      logger.error({ error }, 'Failed to get orders');
      throw error;
    }
  }

  /**
   * Increments retry count for an order
   */
  async incrementRetryCount(orderId: string): Promise<void> {
    const query = `
      UPDATE orders
      SET retry_count = retry_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $1
    `;

    try {
      await database.query(query, [orderId]);
      logger.info({ orderId }, 'Retry count incremented');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to increment retry count');
      throw error;
    }
  }

  /**
   * Maps a database row to an Order object
   */
  private mapRowToOrder(row: any): Order {
    return {
      orderId: row.order_id,
      type: row.type,
      tokenIn: row.token_in,
      tokenOut: row.token_out,
      amountIn: parseFloat(row.amount_in),
      slippage: parseFloat(row.slippage),
      status: row.status,
      selectedDex: row.selected_dex,
      executedPrice: row.executed_price ? parseFloat(row.executed_price) : undefined,
      txHash: row.tx_hash,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      retryCount: row.retry_count,
    };
  }
}

export const orderModel = new OrderModel();
