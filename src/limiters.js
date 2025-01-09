/**
 * Rate limiting algorithms
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
    
    // Fallback for stores that don't support atomic operations
    if (result === null) {
      return this._isAllowedNonAtomic(key, now, windowStart);
    }
    
    const allowed = result.count <= this.maxRequests;
    
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - result.count),
      resetAt: new Date(now + this.windowMs),
      total: this.maxRequests
    };
  }

  async _isAllowedNonAtomic(key, now, windowStart) {
    // Clean old entries and get current count
    await this.store.removeOldEntries(key, windowStart);
    const timestamps = await this.store.getTimestamps(key);
    const currentCount = timestamps.length;
    
    if (currentCount < this.maxRequests) {
      await this.store.addTimestamp(key, now, this.windowMs);
      return {
        allowed: true,
        remaining: this.maxRequests - currentCount - 1,
        resetAt: new Date(now + this.windowMs),
        total: this.maxRequests
      };
    }
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(timestamps[0] + this.windowMs),
      total: this.maxRequests
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
    this.refillRate = options.refillRate || 1; // tokens per second
    this.refillInterval = 1000 / this.refillRate;
  }

  async isAllowed(key, tokensRequired = 1) {
    const now = Date.now();
    
    // Use atomic operation to prevent race conditions
    const result = await this.store.atomicTokenBucket(
      key,
      now,
      this.bucketSize,
      this.refillRate,
      tokensRequired
    );
    
    // Fallback for stores that don't support atomic operations
    if (result === null) {
      return this._isAllowedNonAtomic(key, now, tokensRequired);
    }
    
    return {
      allowed: result.allowed,
      remaining: Math.floor(result.tokens),
      resetAt: new Date(now + ((this.bucketSize - result.tokens) * this.refillInterval)),
      total: this.bucketSize
    };
  }

  async _isAllowedNonAtomic(key, now, tokensRequired) {
    let bucket = await this.store.getBucket(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.bucketSize,
        lastRefill: now
      };
    }

    // Calculate tokens to add based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    bucket.tokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      await this.store.setBucket(key, bucket);
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: new Date(now + ((this.bucketSize - bucket.tokens) * this.refillInterval)),
        total: this.bucketSize
      };
    }

    await this.store.setBucket(key, bucket);
    
    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      resetAt: new Date(now + ((tokensRequired - bucket.tokens) * this.refillInterval)),
      total: this.bucketSize
    };
  }

  async reset(key) {
    await this.store.deleteBucket(key);
  }
}

function createLimiter(type, store, options) {
  switch (type) {
    case 'sliding-window':
      return new SlidingWindowLimiter(store, options);
    case 'token-bucket':
      return new TokenBucketLimiter(store, options);
    default:
      throw new Error(`Unknown limiter type: ${type}`);
  }
}

module.exports = {
  SlidingWindowLimiter,
  TokenBucketLimiter,
  createLimiter
};
