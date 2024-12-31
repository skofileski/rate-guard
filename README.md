# rate-guard

A lightweight rate limiting middleware for Node.js APIs with pluggable storage backends and support for sliding window and token bucket algorithms.

## Installation

```bash
npm install rate-guard
```

For Redis or MongoDB storage, install the respective drivers:
```bash
npm install redis    # for Redis storage
npm install mongodb  # for MongoDB storage
```

## Usage

### Basic Usage (Memory Store)

```javascript
const express = require('express');
const rateGuard = require('rate-guard');

const app = express();

// Apply rate limiting: 100 requests per minute
app.use(rateGuard({
  windowMs: 60000,
  maxRequests: 100
}));

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello!' });
});

app.listen(3000);
```

### Token Bucket Algorithm

```javascript
app.use(rateGuard({
  algorithm: 'token-bucket',
  maxRequests: 50,     // bucket capacity
  windowMs: 60000      // refill period
}));
```

### Redis Storage (Distributed)

```javascript
const { createClient } = require('redis');
const rateGuard = require('rate-guard');

const redisClient = createClient();
await redisClient.connect();

app.use(rateGuard({
  store: new rateGuard.RedisStore(redisClient),
  windowMs: 60000,
  maxRequests: 100
}));
```

### User Tiers

```javascript
app.use(rateGuard({
  maxRequests: 10,  // default for unknown tiers
  tiers: {
    free: { maxRequests: 10, windowMs: 60000 },
    pro: { maxRequests: 100, windowMs: 60000 },
    enterprise: { maxRequests: 1000, windowMs: 60000 }
  },
  tierResolver: async (req) => {
    // Return tier based on user authentication
    return req.user?.plan || 'free';
  }
}));
```

### Custom Key Generator

```javascript
app.use(rateGuard({
  keyGenerator: (req) => req.user?.id || req.ip,
  maxRequests: 100
}));
```

## Response Headers

- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in window
- `X-RateLimit-Reset` - Timestamp when limit resets
- `Retry-After` - Seconds until retry (when rate limited)

## License

MIT