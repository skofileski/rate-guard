# Rate Guard API Documentation

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Middleware](#middleware)
- [Limiters](#limiters)
- [Storage Adapters](#storage-adapters)
- [Rules](#rules)
- [User Tiers](#user-tiers)
- [Configuration](#configuration)

## Installation

```bash
npm install rate-guard
```

## Quick Start

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

const limiter = createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 })
});

app.use(limiter);
```

## Middleware

### createMiddleware(options)

Creates an Express middleware for rate limiting.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `store` | `Store` | `MemoryStore` | Storage adapter instance |
| `limiter` | `Limiter` | `SlidingWindowLimiter` | Rate limiting algorithm |
| `keyGenerator` | `Function` | `req => req.ip` | Function to generate unique client keys |
| `rules` | `RuleEngine` | `null` | Route-specific rules engine |
| `tierManager` | `TierManager` | `null` | User tier management |
| `skip` | `Function` | `() => false` | Function to skip rate limiting |
| `onLimitReached` | `Function` | `null` | Callback when limit is exceeded |

#### Example

```javascript
const middleware = createMiddleware({
  store: new RedisStore({ host: 'localhost', port: 6379 }),
  limiter: new TokenBucketLimiter({ capacity: 100, refillRate: 10 }),
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.path === '/health',
  onLimitReached: (req, res, info) => {
    console.log(`Rate limit exceeded for ${info.key}`);
  }
});
```

## Limiters

### SlidingWindowLimiter

Implements sliding window rate limiting algorithm.

```javascript
const limiter = new SlidingWindowLimiter({
  windowMs: 60000,    // Time window in milliseconds
  maxRequests: 100    // Maximum requests per window
});
```

#### Methods

- `check(key, store)` - Check if request is allowed
- `consume(key, store)` - Consume one token from the bucket
- `reset(key, store)` - Reset the counter for a key

### TokenBucketLimiter

Implements token bucket rate limiting algorithm.

```javascript
const limiter = new TokenBucketLimiter({
  capacity: 100,      // Maximum tokens in bucket
  refillRate: 10,     // Tokens added per second
  refillInterval: 1000 // Refill interval in ms
});
```

## Storage Adapters

### MemoryStore

In-memory storage (suitable for single-process applications).

```javascript
const store = new MemoryStore({
  cleanupInterval: 60000  // Cleanup expired entries every 60s
});
```

### RedisStore

Redis-based storage (recommended for distributed systems).

```javascript
const store = new RedisStore({
  host: 'localhost',
  port: 6379,
  password: 'secret',
  keyPrefix: 'ratelimit:',
  client: existingRedisClient  // Optional: use existing client
});
```

### MongoStore

MongoDB-based storage.

```javascript
const store = new MongoStore({
  uri: 'mongodb://localhost:27017',
  dbName: 'ratelimit',
  collectionName: 'limits',
  client: existingMongoClient  // Optional: use existing client
});
```

## Rules

### RuleEngine

Define route-specific rate limiting rules.

```javascript
const { RuleEngine } = require('rate-guard');

const rules = new RuleEngine();

rules.addRule({
  pattern: '/api/auth/*',
  maxRequests: 5,
  windowMs: 60000
});

rules.addRule({
  pattern: '/api/public/*',
  maxRequests: 1000,
  windowMs: 60000
});

rules.addRule({
  method: 'POST',
  pattern: '/api/upload',
  maxRequests: 10,
  windowMs: 3600000
});
```

## User Tiers

### TierManager

Manage different rate limits based on user tiers.

```javascript
const { TierManager } = require('rate-guard');

const tierManager = new TierManager({
  defaultTier: 'free',
  tiers: {
    free: { maxRequests: 100, windowMs: 60000 },
    basic: { maxRequests: 500, windowMs: 60000 },
    premium: { maxRequests: 2000, windowMs: 60000 },
    enterprise: { maxRequests: 10000, windowMs: 60000 }
  },
  tierResolver: async (req) => {
    return req.user?.tier || 'free';
  }
});
```

## Configuration

### loadConfig(options)

Load configuration from file or environment variables.

```javascript
const { loadConfig } = require('rate-guard');

const config = loadConfig({
  configPath: './rate-guard.config.js',
  env: process.env.NODE_ENV
});
```

### Configuration File Example

```javascript
// rate-guard.config.js
module.exports = {
  store: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    }
  },
  limiter: {
    type: 'sliding-window',
    options: {
      windowMs: 60000,
      maxRequests: 100
    }
  },
  rules: [
    { pattern: '/api/auth/*', maxRequests: 5 }
  ]
};
```

## Response Headers

Rate Guard automatically sets the following headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Remaining requests in window |
| `X-RateLimit-Reset` | Timestamp when the limit resets |
| `Retry-After` | Seconds until requests are allowed (when limited) |
