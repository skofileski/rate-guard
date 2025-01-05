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

    // Get current window data
    let data = await this.store.get(key);
    
    if (!data) {
      data = { timestamps: [] };
    }

    // Ensure timestamps is always an array
    if (!Array.isArray(data.timestamps)) {
      data.timestamps = [];
    }

    // Filter out expired timestamps and handle invalid entries
    data.timestamps = data.timestamps.filter(ts => {
      const timestamp = Number(ts);
      return !isNaN(timestamp) && timestamp > windowStart;
    });

    const currentCount = data.timestamps.length;

    if (currentCount >= this.maxRequests) {
      const oldestTimestamp = Math.min(...data.timestamps);
      const resetTime = oldestTimestamp + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt: resetTime,
        total: this.maxRequests
      };
    }

    // Add current timestamp
    data.timestamps.push(now);
    await this.store.set(key, data, this.windowMs);

    return {
      allowed: true,
      remaining: this.maxRequests - currentCount - 1,
      resetAt: now + this.windowMs,
      total: this.maxRequests
    };
  }

  async reset(key) {
    await this.store.delete(key);
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
    let data = await this.store.get(key);

    if (!data || typeof data.tokens !== 'number' || isNaN(data.tokens)) {
      data = {
        tokens: this.bucketSize,
        lastRefill: now
      };
    }

    // Ensure lastRefill is valid
    if (typeof data.lastRefill !== 'number' || isNaN(data.lastRefill)) {
      data.lastRefill = now;
    }

    // Calculate tokens to add based on time elapsed
    const timePassed = Math.max(0, now - data.lastRefill);
    const tokensToAdd = Math.floor(timePassed / this.refillInterval);
    
    // Refill bucket (cap at bucket size)
    data.tokens = Math.min(this.bucketSize, data.tokens + tokensToAdd);
    
    if (tokensToAdd > 0) {
      data.lastRefill = now;
    }

    // Check if enough tokens available
    if (data.tokens >= tokensRequired) {
      data.tokens -= tokensRequired;
      await this.store.set(key, data);

      return {
        allowed: true,
        remaining: Math.floor(data.tokens),
        resetAt: now + (this.bucketSize - data.tokens) * this.refillInterval,
        total: this.bucketSize
      };
    }

    // Calculate when enough tokens will be available
    const tokensNeeded = tokensRequired - data.tokens;
    const waitTime = Math.ceil(tokensNeeded * this.refillInterval);

    await this.store.set(key, data);

    return {
      allowed: false,
      remaining: Math.floor(data.tokens),
      resetAt: now + waitTime,
      total: this.bucketSize
    };
  }

  async reset(key) {
    await this.store.delete(key);
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
