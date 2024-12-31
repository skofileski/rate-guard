const MemoryStore = require('./stores/memory');
const { SlidingWindowLimiter, TokenBucketLimiter } = require('./limiters');

/**
 * Default key generator - uses IP address
 */
const defaultKeyGenerator = (req) => {
	return req.ip || req.connection.remoteAddress || 'unknown';
};

/**
 * Creates a rate limiting middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.maxRequests - Maximum requests per window (default: 100)
 * @param {string} options.algorithm - 'sliding-window' or 'token-bucket' (default: 'sliding-window')
 * @param {Object} options.store - Storage adapter instance (default: MemoryStore)
 * @param {Function} options.keyGenerator - Function to generate unique client keys
 * @param {Object} options.tiers - User tier configurations { tierName: { maxRequests, windowMs } }
 * @param {Function} options.tierResolver - Function to resolve user tier from request
 * @returns {Function} Express middleware function
 */
function rateGuard(options = {}) {
	const {
		windowMs = 60000,
		maxRequests = 100,
		algorithm = 'sliding-window',
		store = new MemoryStore(),
		keyGenerator = defaultKeyGenerator,
		tiers = null,
		tierResolver = null
	} = options;

	// Create the appropriate limiter based on algorithm
	const createLimiter = (max, window) => {
		if (algorithm === 'token-bucket') {
			return new TokenBucketLimiter(store, max, window);
		}
		return new SlidingWindowLimiter(store, max, window);
	};

	return async function rateLimitMiddleware(req, res, next) {
		try {
			const key = keyGenerator(req);
			
			// Resolve tier-specific limits if configured
			let effectiveMax = maxRequests;
			let effectiveWindow = windowMs;
			
			if (tiers && tierResolver) {
				const tier = await tierResolver(req);
				if (tier && tiers[tier]) {
					effectiveMax = tiers[tier].maxRequests || maxRequests;
					effectiveWindow = tiers[tier].windowMs || windowMs;
				}
			}

			const limiter = createLimiter(effectiveMax, effectiveWindow);
			const result = await limiter.consume(key);

			// Set rate limit headers
			res.setHeader('X-RateLimit-Limit', effectiveMax);
			res.setHeader('X-RateLimit-Remaining', result.remaining);
			res.setHeader('X-RateLimit-Reset', result.resetTime);

			if (!result.allowed) {
				res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
				return res.status(429).json({
					error: 'Too Many Requests',
					message: 'Rate limit exceeded. Please try again later.',
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

// Export main function and utilities
module.exports = rateGuard;
module.exports.MemoryStore = MemoryStore;
module.exports.SlidingWindowLimiter = SlidingWindowLimiter;
module.exports.TokenBucketLimiter = TokenBucketLimiter;

// Lazy load optional stores
module.exports.RedisStore = require('./stores/redis');
module.exports.MongoStore = require('./stores/mongo');