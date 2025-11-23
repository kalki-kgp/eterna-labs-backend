import { Order, OrderStatus, OrderStatusUpdate, DexQuote } from '../types/order.types';
import { mockDexRouter } from './mockDexRouter.service';
import { wsManager } from './websocket.service';
import { orderModel } from '../models/order.model';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Order Execution Service
 * Orchestrates the entire order execution flow with status updates
 */
export class OrderExecutionService {
  /**
   * Executes an order through the full lifecycle
   */
  async executeOrder(order: Order): Promise<void> {
    try {
      // Step 1: PENDING - Order received
      await this.updateStatus(order.orderId, OrderStatus.PENDING);

      // Step 2: ROUTING - Fetch quotes and select best DEX
      await this.updateStatus(order.orderId, OrderStatus.ROUTING);
      const quotes = await mockDexRouter.getAllQuotes(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      // Save quotes for analysis
      await orderModel.saveQuotes(order.orderId, quotes);

      const bestQuote = mockDexRouter.selectBestDex(quotes);

      // Notify about routing decision
      await this.updateStatus(order.orderId, OrderStatus.ROUTING, {
        selectedDex: bestQuote.dex,
        quotes,
      });

      // Step 3: BUILDING - Prepare transaction
      await this.updateStatus(order.orderId, OrderStatus.BUILDING, {
        selectedDex: bestQuote.dex,
      });

      // Simulate transaction building delay
      await this.sleep(500);

      // Step 4: SUBMITTED - Execute swap
      await this.updateStatus(order.orderId, OrderStatus.SUBMITTED, {
        selectedDex: bestQuote.dex,
      });

      const result = await mockDexRouter.executeSwap(order, bestQuote);

      // Step 5: CONFIRMED - Transaction successful
      await this.updateStatus(order.orderId, OrderStatus.CONFIRMED, {
        selectedDex: bestQuote.dex,
        txHash: result.txHash,
        executedPrice: result.executedPrice,
      });

      logger.info(
        {
          orderId: order.orderId,
          txHash: result.txHash,
          dex: result.dex,
        },
        'Order executed successfully'
      );
    } catch (error) {
      await this.handleFailure(order, error as Error, false);
    }
  }

  /**
   * Handles order execution failure
   */
  async handleFailure(order: Order, error: Error, isFinal: boolean): Promise<void> {
    const errorMessage = error.message || 'Unknown error';

    logger.error(
      {
        orderId: order.orderId,
        error: errorMessage,
        isFinal,
        retryCount: order.retryCount,
      },
      'Order execution failed'
    );

    if (!isFinal && (order.retryCount || 0) < config.orderProcessing.retryMaxAttempts - 1) {
      // Increment retry count and log
      await orderModel.incrementRetryCount(order.orderId);

      logger.info(
        {
          orderId: order.orderId,
          retryCount: (order.retryCount || 0) + 1,
          maxAttempts: config.orderProcessing.retryMaxAttempts,
        },
        'Order will be retried'
      );
    } else {
      // Final failure - mark as FAILED
      await this.updateStatus(order.orderId, OrderStatus.FAILED, {
        error: `${errorMessage} (after ${config.orderProcessing.retryMaxAttempts} attempts)`,
      });
    }
  }

  /**
   * Updates order status and sends WebSocket notification
   */
  private async updateStatus(
    orderId: string,
    status: OrderStatus,
    data?: {
      selectedDex?: DexQuote['dex'];
      quotes?: DexQuote[];
      txHash?: string;
      executedPrice?: number;
      error?: string;
    }
  ): Promise<void> {
    const update: OrderStatusUpdate = {
      orderId,
      status,
      timestamp: new Date(),
      data,
    };

    // Update database
    await orderModel.updateStatus(update);

    // Send WebSocket update
    wsManager.sendUpdate(update);

    logger.info({ orderId, status }, 'Order status updated');
  }

  /**
   * Utility sleep function
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validates an order before execution
   */
  validateOrder(order: Partial<Order>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!order.tokenIn || !mockDexRouter.validateTokenAddress(order.tokenIn)) {
      errors.push('Invalid tokenIn address');
    }

    if (!order.tokenOut || !mockDexRouter.validateTokenAddress(order.tokenOut)) {
      errors.push('Invalid tokenOut address');
    }

    if (order.tokenIn === order.tokenOut) {
      errors.push('tokenIn and tokenOut must be different');
    }

    if (!order.amountIn || order.amountIn <= 0) {
      errors.push('amountIn must be greater than 0');
    }

    if (order.slippage !== undefined && !mockDexRouter.validateSlippage(order.slippage)) {
      errors.push('Slippage must be between 0 and 0.5 (0-50%)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const orderExecutionService = new OrderExecutionService();
