export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DexProvider {
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
}

export interface Order {
  orderId: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  status: OrderStatus;
  selectedDex?: DexProvider;
  executedPrice?: number;
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  retryCount?: number;
}

export interface CreateOrderRequest {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
}

export interface DexQuote {
  dex: DexProvider;
  price: number;
  amountOut: number;
  fee: number;
  priceImpact: number;
  timestamp: Date;
}

export interface ExecutionResult {
  orderId: string;
  txHash: string;
  executedPrice: number;
  amountOut: number;
  dex: DexProvider;
  timestamp: Date;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    selectedDex?: DexProvider;
    quotes?: DexQuote[];
    txHash?: string;
    executedPrice?: number;
    error?: string;
  };
}
