import { DexProvider, DexQuote, ExecutionResult, Order } from '../types/order.types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Mock DEX Router Service
 * Simulates quote fetching and order execution for Raydium and Meteora DEXs
 * Includes realistic delays and price variations to simulate network conditions
 */
export class MockDexRouter {
  private readonly delayMinMs: number;
  private readonly delayMaxMs: number;

  constructor() {
    this.delayMinMs = config.mockDex.delayMinMs;
    this.delayMaxMs = config.mockDex.delayMaxMs;
  }

  /**
   * Simulates network delay
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generates a random delay between min and max
   */
  private getRandomDelay(): number {
    return Math.floor(Math.random() * (this.delayMaxMs - this.delayMinMs)) + this.delayMinMs;
  }

  /**
   * Calculates a base price for the token pair
   * In production, this would fetch from on-chain pools
   */
  private getBasePrice(tokenIn: string, tokenOut: string, amountIn: number): number {
    // Simulate different price ranges based on token pairs
    const seed = tokenIn.charCodeAt(0) + tokenOut.charCodeAt(0);
    const baseRate = 0.5 + (seed % 100) / 100; // 0.5 to 1.5
    return amountIn * baseRate;
  }

  /**
   * Fetches quote from Raydium (mocked)
   * Simulates 200ms network delay and price variation
   */
  async getRaydiumQuote(tokenIn: string, tokenOut: string, amountIn: number): Promise<DexQuote> {
    // Simulate network delay
    await this.sleep(200);

    const basePrice = this.getBasePrice(tokenIn, tokenOut, amountIn);
    // Raydium: price variance of -2% to +2%
    const priceVariance = 0.98 + Math.random() * 0.04;
    const price = basePrice * priceVariance;
    const fee = 0.003; // 0.3% fee
    const priceImpact = 0.001 + Math.random() * 0.002; // 0.1-0.3% impact

    const quote: DexQuote = {
      dex: DexProvider.RAYDIUM,
      price,
      amountOut: price * (1 - fee),
      fee,
      priceImpact,
      timestamp: new Date(),
    };

    logger.info({ quote }, 'Raydium quote fetched');
    return quote;
  }

  /**
   * Fetches quote from Meteora (mocked)
   * Simulates 200ms network delay and different price variation
   */
  async getMeteorQuote(tokenIn: string, tokenOut: string, amountIn: number): Promise<DexQuote> {
    // Simulate network delay
    await this.sleep(200);

    const basePrice = this.getBasePrice(tokenIn, tokenOut, amountIn);
    // Meteora: price variance of -3% to +2%
    const priceVariance = 0.97 + Math.random() * 0.05;
    const price = basePrice * priceVariance;
    const fee = 0.002; // 0.2% fee (lower than Raydium)
    const priceImpact = 0.0015 + Math.random() * 0.0025; // 0.15-0.4% impact

    const quote: DexQuote = {
      dex: DexProvider.METEORA,
      price,
      amountOut: price * (1 - fee),
      fee,
      priceImpact,
      timestamp: new Date(),
    };

    logger.info({ quote }, 'Meteora quote fetched');
    return quote;
  }

  /**
   * Fetches quotes from both DEXs concurrently
   */
  async getAllQuotes(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote[]> {
    logger.info({ tokenIn, tokenOut, amountIn }, 'Fetching quotes from all DEXs');

    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amountIn),
      this.getMeteorQuote(tokenIn, tokenOut, amountIn),
    ]);

    return [raydiumQuote, meteoraQuote];
  }

  /**
   * Selects the best DEX based on output amount
   */
  selectBestDex(quotes: DexQuote[]): DexQuote {
    const bestQuote = quotes.reduce((best, current) =>
      current.amountOut > best.amountOut ? current : best
    );

    logger.info(
      {
        selectedDex: bestQuote.dex,
        amountOut: bestQuote.amountOut,
        allQuotes: quotes.map((q) => ({ dex: q.dex, amountOut: q.amountOut })),
      },
      'Best DEX selected'
    );

    return bestQuote;
  }

  /**
   * Executes a swap on the selected DEX (mocked)
   * Simulates 2-3 second execution time
   */
  async executeSwap(order: Order, selectedQuote: DexQuote): Promise<ExecutionResult> {
    logger.info({ orderId: order.orderId, dex: selectedQuote.dex }, 'Executing swap');

    // Simulate execution delay (2-3 seconds)
    const executionDelay = this.getRandomDelay();
    await this.sleep(executionDelay);

    // Simulate slight price slippage during execution (0-1%)
    const slippage = Math.random() * 0.01;
    const executedPrice = selectedQuote.price * (1 - slippage);
    const amountOut = executedPrice * (1 - selectedQuote.fee);

    // Check if slippage exceeds user's tolerance
    const actualSlippage = (selectedQuote.price - executedPrice) / selectedQuote.price;
    if (actualSlippage > order.slippage) {
      throw new Error(
        `Slippage tolerance exceeded: ${(actualSlippage * 100).toFixed(2)}% > ${(order.slippage * 100).toFixed(2)}%`
      );
    }

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Transaction simulation failed: Network congestion');
    }

    const result: ExecutionResult = {
      orderId: order.orderId,
      txHash: this.generateMockTxHash(),
      executedPrice,
      amountOut,
      dex: selectedQuote.dex,
      timestamp: new Date(),
    };

    logger.info({ result }, 'Swap executed successfully');
    return result;
  }

  /**
   * Generates a mock Solana transaction hash
   */
  private generateMockTxHash(): string {
    // Generate a 64-character hex string similar to Solana tx hashes
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  /**
   * Validates if slippage is within acceptable range
   */
  validateSlippage(slippage: number): boolean {
    return slippage >= 0 && slippage <= 0.5; // 0-50%
  }

  /**
   * Validates token addresses (basic validation for mock)
   */
  validateTokenAddress(address: string): boolean {
    // In production, this would validate Solana public key format
    return address.length > 0 && address.length <= 44;
  }
}

export const mockDexRouter = new MockDexRouter();
