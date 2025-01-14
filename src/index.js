/**
 * Rate Guard
 * A lightweight rate limiting middleware with pluggable storage backends
 */

const { SlidingWindowLimiter, TokenBucketLimiter, createLimiter } = require('./limiters');
const { createStore, registerStore, closeAllStores, MemoryStore, RedisStore, MongoStore, BaseStore } = require('./stores');
const { RuleEngine, createRuleEngine } = require('./rules');
const { TierManager } = require('./tiers');
const { createMiddleware, expressMiddleware, connectMiddleware } = require('./middleware');
const { loadConfig, validateConfig, mergeConfig } = require('./config');
const { ValidationError, RateLimitError, ConfigurationError, StoreError } = require('./utils/errors');
const validation = require('./utils/validation');

/**
 * Create a complete rate limiter setup with sensible defaults
 * @param {Object} options - Configuration options
 * @returns {Object} Configured rate limiter instance
 */
function rateGuard(options = {}) {
  const config = mergeConfig(options);
  validateConfig(config);

  // Create store using factory
  const store = createStore(config.store);
  
  // Create limiter
  const limiter = createLimiter({
    algorithm: config.algorithm,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    tokensPerInterval: config.tokensPerInterval,
    bucketSize: config.bucketSize,
    store
  });

  // Create tier manager if tiers are configured
  let tierManager = null;
  if (config.tiers) {
    tierManager = new TierManager(config.tiers);
  }

  // Create rule engine if rules are configured
  let ruleEngine = null;
  if (config.rules) {
    ruleEngine = createRuleEngine(config.rules);
  }

  // Create middleware
  const middleware = createMiddleware({
    limiter,
    tierManager,
    ruleEngine,
    keyGenerator: config.keyGenerator,
    onRateLimited: config.onRateLimited,
    skipFailedRequests: config.skipFailedRequests,
    skip: config.skip,
    headers: config.headers
  });

  return {
    middleware,
    limiter,
    store,
    tierManager,
    ruleEngine,
    
    // Convenience methods
    check: (key) => limiter.check(key),
    consume: (key, tokens = 1) => limiter.consume(key, tokens),
    reset: (key) => limiter.reset(key),
    
    // Cleanup
    close: async () => {
      await store.close();
    }
  };
}

// Main export
module.exports = rateGuard;

// Named exports
module.exports.rateGuard = rateGuard;

// Limiters
module.exports.SlidingWindowLimiter = SlidingWindowLimiter;
module.exports.TokenBucketLimiter = TokenBucketLimiter;
module.exports.createLimiter = createLimiter;

// Stores
module.exports.MemoryStore = MemoryStore;
module.exports.RedisStore = RedisStore;
module.exports.MongoStore = MongoStore;
module.exports.BaseStore = BaseStore;
module.exports.createStore = createStore;
module.exports.registerStore = registerStore;
module.exports.closeAllStores = closeAllStores;

// Rules and Tiers
module.exports.RuleEngine = RuleEngine;
module.exports.createRuleEngine = createRuleEngine;
module.exports.TierManager = TierManager;

// Middleware
module.exports.createMiddleware = createMiddleware;
module.exports.expressMiddleware = expressMiddleware;
module.exports.connectMiddleware = connectMiddleware;

// Configuration
module.exports.loadConfig = loadConfig;
module.exports.validateConfig = validateConfig;
module.exports.mergeConfig = mergeConfig;

// Errors
module.exports.ValidationError = ValidationError;
module.exports.RateLimitError = RateLimitError;
module.exports.ConfigurationError = ConfigurationError;
module.exports.StoreError = StoreError;

// Utilities
module.exports.validation = validation;
