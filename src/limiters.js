/**
 * Rate limiting algorithm implementations
 */

class SlidingWindowLimiter {
  constructor(store, options = {}) {
    this.store = store;
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
  }

  async isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Use atomic operation to prevent race conditions
    const result = await this.store.atomicIncrement(key, now, windowStart, this.windowMs);
    
    // Handle case where store doesn't support atomic operations
    if (result === null) {
      // Fallback to non-atomic operation with optimistic locking
      await this.store.removeExpired(key, windowStart);
      const count = await this.store.count(key, windowStart, now);
      
      if (count >= this.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: await this.store.getOldestTimestamp(key) + this.windowMs
        };
      }
      
      await this.store.add(key, now);
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - count - 1),
        resetAt: now + this.windowMs
      };
    }
    
    const allowed = result.count <= this.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - result.count),
      resetAt: result.resetAt || now + this.windowMs
    };
  }

  async reset(key) {
    await this.store.clear(key);
  }
}

class TokenBucketLimiter {
  constructor(store, options = {}) {
    this.store = store;
    this.bucketSize = options.bucketSize || 10;
    this.refillRate = options.refillRate || 1;
    this.refillInterval = options.refillInterval || 1000;
  }

  async isAllowed(key, tokensRequired = 1) {
    // Validate tokensRequired
    if (tokensRequired <= 0) {
      tokensRequired = 1;
    }
    
    if (tokensRequired > this.bucketSize) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + (tokensRequired - this.bucketSize) * this.refillInterval / this.refillRate,
        reason: 'Request exceeds bucket capacity'
      };
    }
    
    const now = Date.now();
    let bucket = await this.store.get(key);
    
    if (!bucket || typeof bucket.tokens === 'undefined') {
      bucket = {
        tokens: this.bucketSize,
        lastRefill: now
      };
    }
    
    // Calculate tokens to add based on time elapsed
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = Math.floor(elapsed / this.refillInterval) * this.refillRate;
    
    // Ensure tokens don't exceed bucket size and handle NaN
    bucket.tokens = Math.min(
      this.bucketSize,
      (isNaN(bucket.tokens) ? 0 : bucket.tokens) + tokensToAdd
    );
    bucket.lastRefill = now;
    
    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      await this.store.set(key, bucket);
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: now + this.refillInterval
      };
    }
    
    await this.store.set(key, bucket);
    
    // Calculate when enough tokens will be available
    const tokensNeeded = tokensRequired - bucket.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.refillRate) * this.refillInterval;
    
    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      resetAt: now + waitTime
    };
  }

  async reset(key) {
    await this.store.delete(key);
  }
  
  async getStatus(key) {
    const bucket = await this.store.get(key);
    if (!bucket) {
      return {
        tokens: this.bucketSize,
        bucketSize: this.bucketSize
      };
    }
    
    const now = Date.now();
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = Math.floor(elapsed / this.refillInterval) * this.refillRate;
    const currentTokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
    
    return {
      tokens: Math.floor(currentTokens),
      bucketSize: this.bucketSize
    };
  }
}

function createLimiter(type, store, options) {
  if (!store) {
    throw new Error('Store is required to create a limiter');
  }
  
  switch (type) {
    case 'sliding-window':
      return new SlidingWindowLimiter(store, options);
    case 'token-bucket':
      return new TokenBucketLimiter(store, options);
    default:
      throw new Error(`Unknown limiter type: ${type}. Supported types: sliding-window, token-bucket`);
  }
}

module.exports = {
  SlidingWindowLimiter,
  TokenBucketLimiter,
  createLimiter
};
