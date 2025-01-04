declare module 'rate-guard' {
  import { Request, Response, NextFunction } from 'express';

  export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string | null;
    db?: number;
    keyPrefix?: string;
  }

  export interface MongoConfig {
    uri?: string;
    dbName?: string;
    collectionName?: string;
  }

  export interface RateLimitConfig {
    windowMs?: number;
    maxRequests?: number;
    bucketSize?: number;
    refillRate?: number;
    store?: 'memory' | 'redis' | 'mongo';
    redis?: RedisConfig;
    mongo?: MongoConfig;
    statusCode?: number;
    message?: string;
    headers?: boolean;
    skip?: ((req: Request) => boolean) | null;
    keyGenerator?: ((req: Request) => string) | null;
    enableLogging?: boolean;
  }

  export interface RateLimitInfo {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  }

  export interface Store {
    increment(key: string): Promise<RateLimitInfo>;
    get(key: string): Promise<RateLimitInfo | null>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
  }

  export interface RuleDefinition {
    windowMs?: number;
    maxRequests?: number;
    condition?: (req: Request) => boolean;
  }

  export type Middleware = (req: Request, res: Response, next: NextFunction) => void;

  export function slidingWindow(config?: RateLimitConfig): Middleware;
  export function tokenBucket(config?: RateLimitConfig): Middleware;

  export class MemoryStore implements Store {
    constructor(config?: RateLimitConfig);
    increment(key: string): Promise<RateLimitInfo>;
    get(key: string): Promise<RateLimitInfo | null>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
  }

  export class RedisStore implements Store {
    constructor(config?: RedisConfig);
    increment(key: string): Promise<RateLimitInfo>;
    get(key: string): Promise<RateLimitInfo | null>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
  }

  export class MongoStore implements Store {
    constructor(config?: MongoConfig);
    increment(key: string): Promise<RateLimitInfo>;
    get(key: string): Promise<RateLimitInfo | null>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
  }

  export class RuleEngine {
    constructor();
    addRule(name: string, rule: RuleDefinition): this;
    removeRule(name: string): this;
    getRule(name: string): RuleDefinition | undefined;
    evaluate(req: Request): RuleDefinition;
  }

  export default function rateGuard(config?: RateLimitConfig): Middleware;
}
