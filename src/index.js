/**
 * rate-guard
 * A lightweight rate limiting middleware with pluggable storage backends
 */

const { SlidingWindowLimiter, TokenBucketLimiter } = require('./limiters');
const { MemoryStore } = require('./stores/memory');
const { RedisStore } = require('./stores/redis');
const { MongoStore } = require('./stores/mongo');
const { RuleEngine } = require('./rules');

/**
 * Create rate limiting middleware
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
  const {
    store = new MemoryStore(),
    algorithm = 'sliding-window',
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = defaultKeyGenerator,
    tierExtractor = () => null,
    skipFailedRequests = false,
    onLimitReached = null,
    rules = null
  } = options;

  const ruleEngine = rules instanceof RuleEngine ? rules : new RuleEngine({
    windowMs,
    maxRequests,
    algorithm
  });

  const limiters = {
    'sliding-window': (opts) => new SlidingWindowLimiter(store, opts),
    'token-bucket': (opts) => new TokenBucketLimiter(store, opts)
  };

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const tier = await tierExtractor(req);
      const route = req.path || req.url;
      const rule = ruleEngine.getRule(route, tier);
      
      const key = ruleEngine.generateKey({
        ip: req.ip || req.connection?.remoteAddress,
        userId: req.user?.id,
        route,
        tier
      });

      const LimiterClass = limiters[rule.algorithm];
      if (!LimiterClass) {
        throw new Error(`Unknown algorithm: ${rule.algorithm}`);
      }

      const limiter = LimiterClass(rule);
      const result = await limiter.consume(key);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', result.limit);
      res.set('X-RateLimit-Remaining', result.remaining);
      res.set('X-RateLimit-Reset', result.resetTime);

      if (!result.allowed) {
        res.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        
        if (onLimitReached) {
          return onLimitReached(req, res, next, result);
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      next();
    } catch (error) {
      // Fail open - allow request if rate limiter fails
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

/**
 * Default key generator
 */
function defaultKeyGenerator(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

module.exports = {
  createRateLimiter,
  RuleEngine,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  MemoryStore,
  RedisStore,
  MongoStore
};
