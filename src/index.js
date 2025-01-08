/**
 * rate-guard - Lightweight rate limiting middleware
 */

const { SlidingWindowLimiter, TokenBucketLimiter } = require('./limiters');
const { MemoryStore } = require('./stores/memory');
const { RedisStore } = require('./stores/redis');
const { MongoStore } = require('./stores/mongo');
const { RuleEngine, createRule } = require('./rules');
const { loadConfig, validateConfig, DEFAULT_CONFIG } = require('./config');
const { TierManager, createTierManager, DEFAULT_TIERS } = require('./tiers');

/**
 * Create rate limiting middleware
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  validateConfig(config);

  const store = config.store || new MemoryStore();
  const limiter = config.algorithm === 'token-bucket'
    ? new TokenBucketLimiter(store, config)
    : new SlidingWindowLimiter(store, config);

  const ruleEngine = config.ruleEngine || null;
  const tierManager = config.tierManager || null;

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const identifier = config.keyGenerator
        ? config.keyGenerator(req)
        : req.ip || req.connection.remoteAddress;

      let effectiveConfig = config;

      // Apply tier-based limits if tier manager is configured
      if (tierManager) {
        const tier = await tierManager.resolveTier(req, identifier);
        effectiveConfig = {
          ...config,
          windowMs: tier.windowMs,
          maxRequests: tier.maxRequests,
          bucketSize: tier.tokenBucketSize,
          refillRate: tier.tokenRefillRate
        };
        req.rateLimitTier = tier.name;
      }

      // Apply rule-based limits if rule engine is configured
      if (ruleEngine) {
        const ruleConfig = ruleEngine.evaluate(req);
        if (ruleConfig) {
          effectiveConfig = { ...effectiveConfig, ...ruleConfig };
        }
      }

      // Update limiter config if it changed
      if (effectiveConfig !== config) {
        limiter.updateConfig(effectiveConfig);
      }

      const result = await limiter.consume(identifier);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(effectiveConfig.maxRequests || effectiveConfig.bucketSize));
      res.set('X-RateLimit-Remaining', String(result.remaining));
      res.set('X-RateLimit-Reset', String(result.resetTime));

      if (req.rateLimitTier) {
        res.set('X-RateLimit-Tier', req.rateLimitTier);
      }

      if (!result.allowed) {
        res.set('Retry-After', String(Math.ceil(result.retryAfter / 1000)));
        
        if (config.handler) {
          return config.handler(req, res, next, result);
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
          tier: req.rateLimitTier || undefined
        });
      }

      req.rateLimit = result;
      next();
    } catch (error) {
      if (config.skipOnError) {
        console.error('Rate limiter error:', error.message);
        return next();
      }
      next(error);
    }
  };
}

/**
 * Create a rate limiter with tier support
 * @param {Object} options - Configuration options
 * @param {Object} tierConfig - Tier configuration
 * @returns {Function} Express middleware
 */
function createTieredRateLimiter(options = {}, tierConfig = {}) {
  const tierManager = createTierManager(tierConfig.tiers);
  
  if (tierConfig.resolver) {
    tierManager.setTierResolver(tierConfig.resolver);
  }
  
  if (tierConfig.assignments) {
    tierManager.bulkAssign(tierConfig.assignments);
  }
  
  return createRateLimiter({
    ...options,
    tierManager
  });
}

module.exports = {
  createRateLimiter,
  createTieredRateLimiter,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  MemoryStore,
  RedisStore,
  MongoStore,
  RuleEngine,
  createRule,
  TierManager,
  createTierManager,
  loadConfig,
  validateConfig,
  DEFAULT_CONFIG,
  DEFAULT_TIERS
};
