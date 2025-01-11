const { SlidingWindowLimiter, TokenBucketLimiter } = require('./limiters');
const { MemoryStore } = require('./stores/memory');
const { RuleEngine } = require('./rules');
const { TierManager } = require('./tiers');
const { Config } = require('./config');

class RateLimitMiddleware {
  constructor(options = {}) {
    this.config = new Config(options);
    this.store = options.store || new MemoryStore();
    this.ruleEngine = options.ruleEngine || new RuleEngine();
    this.tierManager = options.tierManager || new TierManager();
    
    const LimiterClass = this.config.get('algorithm') === 'token-bucket'
      ? TokenBucketLimiter
      : SlidingWindowLimiter;
    
    this.limiter = new LimiterClass(this.store, {
      windowMs: this.config.get('windowMs'),
      maxRequests: this.config.get('maxRequests'),
      tokensPerInterval: this.config.get('tokensPerInterval'),
      interval: this.config.get('interval'),
      bucketSize: this.config.get('bucketSize')
    });

    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    this.onRateLimited = options.onRateLimited || null;
    this.skip = options.skip || (() => false);
  }

  defaultKeyGenerator(req) {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  extractRequestInfo(req) {
    // Normalize request object for Express/Koa compatibility
    return {
      ip: req.ip || req.connection?.remoteAddress,
      path: req.path || req.url,
      method: req.method,
      headers: req.headers,
      user: req.user || null
    };
  }

  async checkLimit(key, requestInfo) {
    // Check for route-specific rules
    const rule = this.ruleEngine.match(requestInfo.path, requestInfo.method);
    
    // Check for user tier limits
    let tierConfig = null;
    if (requestInfo.user?.tier) {
      tierConfig = this.tierManager.getTier(requestInfo.user.tier);
    }

    // Determine effective limits
    let effectiveLimits = {
      maxRequests: this.config.get('maxRequests'),
      windowMs: this.config.get('windowMs')
    };

    if (rule) {
      effectiveLimits = { ...effectiveLimits, ...rule.limits };
    }

    if (tierConfig) {
      effectiveLimits = { ...effectiveLimits, ...tierConfig };
    }

    return this.limiter.tryAcquire(key, effectiveLimits);
  }

  setRateLimitHeaders(res, result) {
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', result.resetTime);
    
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000));
    }
  }

  express() {
    return async (req, res, next) => {
      try {
        if (await this.skip(req)) {
          return next();
        }

        const requestInfo = this.extractRequestInfo(req);
        const key = await this.keyGenerator(req);
        const result = await this.checkLimit(key, requestInfo);

        this.setRateLimitHeaders(res, result);

        if (!result.allowed) {
          if (this.onRateLimited) {
            return this.onRateLimited(req, res, next, result);
          }
          
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil(result.retryAfter / 1000)
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  koa() {
    return async (ctx, next) => {
      try {
        const req = {
          ip: ctx.ip,
          path: ctx.path,
          method: ctx.method,
          headers: ctx.headers,
          user: ctx.state?.user
        };

        if (await this.skip(req)) {
          return next();
        }

        const requestInfo = this.extractRequestInfo(req);
        const key = await this.keyGenerator(req);
        const result = await this.checkLimit(key, requestInfo);

        ctx.set('X-RateLimit-Limit', result.limit);
        ctx.set('X-RateLimit-Remaining', Math.max(0, result.remaining));
        ctx.set('X-RateLimit-Reset', result.resetTime);

        if (!result.allowed) {
          ctx.set('Retry-After', Math.ceil(result.retryAfter / 1000));
          
          if (this.onRateLimited) {
            return this.onRateLimited(ctx, next, result);
          }

          ctx.status = 429;
          ctx.body = {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil(result.retryAfter / 1000)
          };
          return;
        }

        await next();
      } catch (error) {
        ctx.throw(500, error.message);
      }
    };
  }
}

function createMiddleware(options = {}) {
  return new RateLimitMiddleware(options);
}

module.exports = {
  RateLimitMiddleware,
  createMiddleware
};
