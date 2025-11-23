import { MockDexRouter } from '../mockDexRouter.service';
import { DexProvider } from '../../types/order.types';

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  describe('getRaydiumQuote', () => {
    it('should return a valid Raydium quote', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 100);

      expect(quote).toHaveProperty('dex', DexProvider.RAYDIUM);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('amountOut');
      expect(quote).toHaveProperty('fee', 0.003);
      expect(quote).toHaveProperty('priceImpact');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
    });

    it('should simulate network delay', async () => {
      const start = Date.now();
      await router.getRaydiumQuote('SOL', 'USDC', 100);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(200);
    });
  });

  describe('getMeteorQuote', () => {
    it('should return a valid Meteora quote', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 100);

      expect(quote).toHaveProperty('dex', DexProvider.METEORA);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('amountOut');
      expect(quote).toHaveProperty('fee', 0.002);
      expect(quote).toHaveProperty('priceImpact');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
    });
  });

  describe('getAllQuotes', () => {
    it('should return quotes from both DEXs', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);

      expect(quotes).toHaveLength(2);
      expect(quotes.some((q) => q.dex === DexProvider.RAYDIUM)).toBe(true);
      expect(quotes.some((q) => q.dex === DexProvider.METEORA)).toBe(true);
    });

    it('should fetch quotes concurrently', async () => {
      const start = Date.now();
      await router.getAllQuotes('SOL', 'USDC', 100);
      const duration = Date.now() - start;

      // Should take ~200ms (concurrent) not ~400ms (sequential)
      expect(duration).toBeLessThan(400);
    });
  });

  describe('selectBestDex', () => {
    it('should select the DEX with highest amountOut', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
      const bestQuote = router.selectBestDex(quotes);

      const maxAmountOut = Math.max(...quotes.map((q) => q.amountOut));
      expect(bestQuote.amountOut).toBe(maxAmountOut);
    });

    it('should return a valid quote', async () => {
      const quotes = await router.getAllQuotes('SOL', 'USDC', 100);
      const bestQuote = router.selectBestDex(quotes);

      expect([DexProvider.RAYDIUM, DexProvider.METEORA]).toContain(bestQuote.dex);
      expect(bestQuote.amountOut).toBeGreaterThan(0);
    });
  });

  describe('validateSlippage', () => {
    it('should accept valid slippage values', () => {
      expect(router.validateSlippage(0)).toBe(true);
      expect(router.validateSlippage(0.01)).toBe(true);
      expect(router.validateSlippage(0.5)).toBe(true);
    });

    it('should reject invalid slippage values', () => {
      expect(router.validateSlippage(-0.1)).toBe(false);
      expect(router.validateSlippage(0.6)).toBe(false);
      expect(router.validateSlippage(1)).toBe(false);
    });
  });

  describe('validateTokenAddress', () => {
    it('should accept valid token addresses', () => {
      expect(router.validateTokenAddress('SOL')).toBe(true);
      expect(router.validateTokenAddress('USDC')).toBe(true);
      expect(router.validateTokenAddress('A'.repeat(44))).toBe(true);
    });

    it('should reject invalid token addresses', () => {
      expect(router.validateTokenAddress('')).toBe(false);
      expect(router.validateTokenAddress('A'.repeat(45))).toBe(false);
    });
  });
});
