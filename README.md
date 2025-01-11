# Rate Guard

A lightweight, flexible rate limiting middleware for Node.js applications with pluggable storage backends.

[![npm version](https://badge.fury.io/js/rate-guard.svg)](https://badge.fury.io/js/rate-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Multiple Algorithms**: Sliding window and token bucket rate limiting
- 💾 **Pluggable Storage**: Memory, Redis, and MongoDB adapters
- 🎯 **Route-Specific Rules**: Define different limits for different endpoints
- 👥 **User Tiers**: Support for tiered rate limits (free, premium, enterprise)
- 📊 **Standard Headers**: Automatic rate limit headers (X-RateLimit-*)
- 🔧 **Highly Configurable**: Customize every aspect of rate limiting
- 📝 **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install rate-guard
```

## Quick Start

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

// Apply rate limiting: 100 requests per minute
app.use(createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100
  })
}));

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
```

## Documentation

- [API Reference](./docs/API.md)
- [Examples](./docs/EXAMPLES.md)

## Storage Adapters

### Memory (Default)

Suitable for single-process applications:

```javascript
const store = new MemoryStore();
```

### Redis

Recommended for distributed systems:

```javascript
const store = new RedisStore({
  host: 'localhost',
  port: 6379
});
```

### MongoDB

```javascript
const store = new MongoStore({
  uri: 'mongodb://localhost:27017',
  dbName: 'myapp'
});
```

## Rate Limiting Algorithms

### Sliding Window

Provides smooth rate limiting by considering a rolling time window:

```javascript
const limiter = new SlidingWindowLimiter({
  windowMs: 60000,
  maxRequests: 100
});
```

### Token Bucket

Allows for burst traffic while maintaining average rate:

```javascript
const limiter = new TokenBucketLimiter({
  capacity: 100,
  refillRate: 10
});
```

## User Tiers

Support different rate limits based on user subscription tier:

```javascript
const tierManager = new TierManager({
  defaultTier: 'free',
  tiers: {
    free: { maxRequests: 100, windowMs: 60000 },
    premium: { maxRequests: 1000, windowMs: 60000 }
  },
  tierResolver: (req) => req.user?.tier || 'free'
});
```

## Response Headers

Rate Guard automatically sets standard rate limit headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details.
