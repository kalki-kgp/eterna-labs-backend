export interface ServerConfig {
  port: number;
  nodeEnv: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface OrderProcessingConfig {
  maxConcurrentOrders: number;
  orderRateLimit: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
}

export interface MockDexConfig {
  mockMode: boolean;
  delayMinMs: number;
  delayMaxMs: number;
}

export interface AppConfig {
  server: ServerConfig;
  redis: RedisConfig;
  postgres: PostgresConfig;
  orderProcessing: OrderProcessingConfig;
  mockDex: MockDexConfig;
}
