import { OrderExecutionService } from '../orderExecution.service';
import { OrderType } from '../../types/order.types';

describe('OrderExecutionService', () => {
  let service: OrderExecutionService;

  beforeEach(() => {
    service = new OrderExecutionService();
  });

  describe('validateOrder', () => {
    it('should validate a correct order', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject order with missing tokenIn', () => {
      const order = {
        type: OrderType.MARKET,
        tokenOut: 'USDC',
        amountIn: 100,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid tokenIn address');
    });

    it('should reject order with missing tokenOut', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        amountIn: 100,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid tokenOut address');
    });

    it('should reject order with same tokenIn and tokenOut', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'SOL',
        amountIn: 100,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tokenIn and tokenOut must be different');
    });

    it('should reject order with invalid amountIn', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 0,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amountIn must be greater than 0');
    });

    it('should reject order with negative amountIn', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: -10,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
    });

    it('should reject order with invalid slippage', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.6,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Slippage must be between 0 and 0.5 (0-50%)');
    });

    it('should accept order without slippage (optional)', () => {
      const order = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
      };

      const result = service.validateOrder(order);

      expect(result.valid).toBe(true);
    });
  });
});
