const { SlidingWindowLimiter, TokenBucketLimiter } = require('./limiters');
const { MemoryStore } = require('./stores/memory');
const { RedisStore } = require('./stores/redis');
const { MongoStore } = require('./stores/mongo');
const { RuleEngine } = require('./rules');
const { Config } = require('./config');
const { TierManager } = require('./tiers');
const { RateLimitMiddleware, createMiddleware } = require('./middleware');

module.exports = {
  // Main middleware
  RateLimitMiddleware,
  createMiddleware,
  
  // Limiters
  SlidingWindowLimiter,
  TokenBucketLimiter,
  
  // Storage backends
  MemoryStore,
  RedisStore,
  MongoStore,
  
  // Configuration
  RuleEngine,
  Config,
  TierManager,
  
  // Convenience factory
  rateLimit: createMiddleware
};
