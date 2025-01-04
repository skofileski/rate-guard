/**
 * Rate limiting algorithm implementations
 */

/**
 * Sliding Window Rate Limiter
 * Tracks requests within a time window that slides forward
 */
class SlidingWindowLimiter {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 60000; // Default 1 minute
    this.maxRequests = options.maxRequests || 100;
  }

  /**
   * Check if request is allowed under the sliding window
   * @param {object} store - Storage adapter instance
   * @param {string} key - Unique identifier for the client
   * @returns {Promise<object>} Result with allowed status and metadata
   */
  async isAllowed(store, key) {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Get current timestamps
    let timestamps = await store.get(key) || [];
    
    // Ensure timestamps is an array (handle corrupted data)
    if (!Array.isArray(timestamps)) {
      timestamps = [];
    }

    // Filter out timestamps outside the current window
    // Also filter out any invalid/NaN timestamps
    const validTimestamps = timestamps.filter(ts => {
      const timestamp = Number(ts);
      return !isNaN(timestamp) && timestamp > windowStart && timestamp <= now;
    });

    const requestCount = validTimestamps.length;

    if (requestCount >= this.maxRequests) {
      // Find the oldest timestamp to calculate retry time
      const oldestTimestamp = Math.min(...validTimestamps);
      const retryAfter = Math.max(0, Math.ceil((oldestTimestamp + this.windowSize - now) / 1000));
      
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit: this.maxRequests,
        windowSize: this.windowSize
      };
    }

    // Add current timestamp and save
    validTimestamps.push(now);
    await store.set(key, validTimestamps, this.windowSize);

    return {
      allowed: true,
      remaining: this.maxRequests - validTimestamps.length,
      retryAfter: 0,
      limit: this.maxRequests,
      windowSize: this.windowSize
    };
  }

  /**
   * Reset the rate limit for a key
   * @param {object} store - Storage adapter instance
   * @param {string} key - Unique identifier for the client
   */
  async reset(store, key) {
    await store.delete(key);
  }
}

/**
 * Token Bucket Rate Limiter
 * Allows bursts while maintaining average rate
 */
class TokenBucketLimiter {
  constructor(options = {}) {
    this.bucketSize = options.bucketSize || 100; // Max tokens
    this.refillRate = options.refillRate || 10; // Tokens per second
    this.refillInterval = options.refillInterval || 1000; // Refill check interval
  }

  /**
   * Check if request is allowed and consume a token
   * @param {object} store - Storage adapter instance
   * @param {string} key - Unique identifier for the client
   * @param {number} tokens - Number of tokens to consume (default 1)
   * @returns {Promise<object>} Result with allowed status and metadata
   */
  async isAllowed(store, key, tokens = 1) {
    const now = Date.now();
    let bucket = await store.get(key);

    // Initialize bucket if it doesn't exist or is invalid
    if (!bucket || typeof bucket !== 'object' || typeof bucket.tokens !== 'number') {
      bucket = {
        tokens: this.bucketSize,
        lastRefill: now
      };
    }

    // Ensure lastRefill is valid
    if (typeof bucket.lastRefill !== 'number' || isNaN(bucket.lastRefill)) {
      bucket.lastRefill = now;
    }

    // Calculate tokens to add based on time elapsed
    const timePassed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);
    
    // Refill the bucket (cap at bucket size)
    bucket.tokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
    
    // Only update lastRefill if tokens were actually added
    if (tokensToAdd > 0) {
      bucket.lastRefill = now;
    }

    // Ensure tokens doesn't go below 0 due to any edge cases
    bucket.tokens = Math.max(0, bucket.tokens);

    if (bucket.tokens < tokens) {
      // Calculate when enough tokens will be available
      const tokensNeeded = tokens - bucket.tokens;
      const retryAfter = Math.ceil(tokensNeeded / this.refillRate);

      // Still save the refilled state
      await store.set(key, bucket);

      return {
        allowed: false,
        remaining: Math.floor(bucket.tokens),
        retryAfter,
        limit: this.bucketSize,
        refillRate: this.refillRate
      };
    }

    // Consume tokens
    bucket.tokens -= tokens;
    await store.set(key, bucket);

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfter: 0,
      limit: this.bucketSize,
      refillRate: this.refillRate
    };
  }

  /**
   * Reset the bucket for a key
   * @param {object} store - Storage adapter instance
   * @param {string} key - Unique identifier for the client
   */
  async reset(store, key) {
    await store.delete(key);
  }
}

/**
 * Factory function to create a limiter instance
 * @param {string} type - Type of limiter ('sliding-window' or 'token-bucket')
 * @param {object} options - Limiter configuration options
 * @returns {SlidingWindowLimiter|TokenBucketLimiter}
 */
function createLimiter(type, options = {}) {
  switch (type) {
    case 'sliding-window':
      return new SlidingWindowLimiter(options);
    case 'token-bucket':
      return new TokenBucketLimiter(options);
    default:
      throw new Error(`Unknown limiter type: ${type}`);
  }
}

module.exports = {
  SlidingWindowLimiter,
  TokenBucketLimiter,
  createLimiter
};
