/**
 * Sliding Window Rate Limiter
 * Provides smooth rate limiting by tracking requests in a sliding time window
 */
class SlidingWindowLimiter {
	constructor(store, maxRequests, windowMs) {
		this.store = store;
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
	}

	/**
	 * Attempt to consume a request token
	 * @param {string} key - Unique identifier for the client
	 * @returns {Object} { allowed, remaining, resetTime }
	 */
	async consume(key) {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		const fullKey = `sw:${key}`;

		// Get current window data
		let data = await this.store.get(fullKey);
		
		if (!data) {
			data = { timestamps: [] };
		}

		// Filter out expired timestamps
		data.timestamps = data.timestamps.filter(ts => ts > windowStart);

		const currentCount = data.timestamps.length;
		const resetTime = data.timestamps.length > 0 
			? data.timestamps[0] + this.windowMs 
			: now + this.windowMs;

		if (currentCount >= this.maxRequests) {
			return {
				allowed: false,
				remaining: 0,
				resetTime
			};
		}

		// Add current timestamp
		data.timestamps.push(now);
		await this.store.set(fullKey, data, this.windowMs);

		return {
			allowed: true,
			remaining: this.maxRequests - data.timestamps.length,
			resetTime
		};
	}
}

/**
 * Token Bucket Rate Limiter
 * Allows bursting while maintaining an average rate limit
 */
class TokenBucketLimiter {
	constructor(store, maxTokens, refillMs) {
		this.store = store;
		this.maxTokens = maxTokens;
		this.refillMs = refillMs;
		this.refillRate = maxTokens / refillMs; // tokens per ms
	}

	/**
	 * Attempt to consume a token
	 * @param {string} key - Unique identifier for the client
	 * @returns {Object} { allowed, remaining, resetTime }
	 */
	async consume(key) {
		const now = Date.now();
		const fullKey = `tb:${key}`;

		let bucket = await this.store.get(fullKey);

		if (!bucket) {
			bucket = {
				tokens: this.maxTokens,
				lastRefill: now
			};
		}

		// Calculate tokens to add based on time elapsed
		const elapsed = now - bucket.lastRefill;
		const tokensToAdd = elapsed * this.refillRate;
		bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
		bucket.lastRefill = now;

		const resetTime = now + Math.ceil((this.maxTokens - bucket.tokens) / this.refillRate);

		if (bucket.tokens < 1) {
			await this.store.set(fullKey, bucket, this.refillMs);
			return {
				allowed: false,
				remaining: 0,
				resetTime
			};
		}

		// Consume a token
		bucket.tokens -= 1;
		await this.store.set(fullKey, bucket, this.refillMs);

		return {
			allowed: true,
			remaining: Math.floor(bucket.tokens),
			resetTime
		};
	}
}

module.exports = { SlidingWindowLimiter, TokenBucketLimiter };