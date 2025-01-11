# Rate Guard Examples

## Basic Express Setup

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

// Simple rate limiting: 100 requests per minute
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

## Redis Store with Token Bucket

```javascript
const express = require('express');
const {
  createMiddleware,
  RedisStore,
  TokenBucketLimiter
} = require('rate-guard');

const app = express();

const store = new RedisStore({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  keyPrefix: 'myapp:ratelimit:'
});

const limiter = new TokenBucketLimiter({
  capacity: 50,
  refillRate: 5,
  refillInterval: 1000
});

app.use(createMiddleware({ store, limiter }));

app.listen(3000);
```

## Route-Specific Rules

```javascript
const express = require('express');
const {
  createMiddleware,
  MemoryStore,
  SlidingWindowLimiter,
  RuleEngine
} = require('rate-guard');

const app = express();

const rules = new RuleEngine();

// Strict limits for authentication endpoints
rules.addRule({
  pattern: '/api/auth/login',
  method: 'POST',
  maxRequests: 5,
  windowMs: 15 * 60 * 1000 // 5 attempts per 15 minutes
});

// Moderate limits for API endpoints
rules.addRule({
  pattern: '/api/*',
  maxRequests: 100,
  windowMs: 60 * 1000
});

// Higher limits for public content
rules.addRule({
  pattern: '/public/*',
  maxRequests: 500,
  windowMs: 60 * 1000
});

app.use(createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 }),
  rules
}));

app.post('/api/auth/login', (req, res) => {
  res.json({ token: 'xxx' });
});

app.get('/api/users', (req, res) => {
  res.json([]);
});

app.listen(3000);
```

## User Tier-Based Limits

```javascript
const express = require('express');
const {
  createMiddleware,
  RedisStore,
  SlidingWindowLimiter,
  TierManager
} = require('rate-guard');

const app = express();

// Simulated user authentication middleware
app.use((req, res, next) => {
  // In real app, this would come from JWT/session
  req.user = {
    id: 'user123',
    tier: 'premium'
  };
  next();
});

const tierManager = new TierManager({
  defaultTier: 'free',
  tiers: {
    free: { maxRequests: 100, windowMs: 60000 },
    basic: { maxRequests: 500, windowMs: 60000 },
    premium: { maxRequests: 2000, windowMs: 60000 },
    enterprise: { maxRequests: 10000, windowMs: 60000 }
  },
  tierResolver: async (req) => req.user?.tier || 'free'
});

app.use(createMiddleware({
  store: new RedisStore({ host: 'localhost' }),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 }),
  tierManager,
  keyGenerator: (req) => req.user?.id || req.ip
}));

app.get('/api/data', (req, res) => {
  res.json({ data: 'premium content' });
});

app.listen(3000);
```

## Custom Key Generation

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

app.use(createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 }),
  // Rate limit by API key instead of IP
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return `api:${apiKey}`;
    }
    return `ip:${req.ip}`;
  }
}));

app.listen(3000);
```

## Skip Certain Requests

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

app.use(createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 }),
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    
    // Skip for internal requests
    if (req.headers['x-internal-request'] === 'true') return true;
    
    // Skip for whitelisted IPs
    const whitelist = ['127.0.0.1', '10.0.0.1'];
    if (whitelist.includes(req.ip)) return true;
    
    return false;
  }
}));

app.listen(3000);
```

## Custom Error Handling

```javascript
const express = require('express');
const { createMiddleware, MemoryStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

app.use(createMiddleware({
  store: new MemoryStore(),
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 }),
  onLimitReached: (req, res, limitInfo) => {
    // Log the event
    console.log(`Rate limit exceeded: ${limitInfo.key}`);
    
    // Send custom response
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Please slow down your requests',
      retryAfter: limitInfo.resetTime,
      limit: limitInfo.limit,
      current: limitInfo.current
    });
  }
}));

app.listen(3000);
```

## MongoDB Store

```javascript
const express = require('express');
const { createMiddleware, MongoStore, SlidingWindowLimiter } = require('rate-guard');

const app = express();

const store = new MongoStore({
  uri: 'mongodb://localhost:27017',
  dbName: 'myapp',
  collectionName: 'rate_limits'
});

app.use(createMiddleware({
  store,
  limiter: new SlidingWindowLimiter({ windowMs: 60000, maxRequests: 100 })
}));

app.listen(3000);
```
