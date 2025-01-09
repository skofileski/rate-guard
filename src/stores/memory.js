/**
 * In-memory storage adapter for rate limiting
 */

class MemoryStore {
  constructor(options = {}) {
    this.timestamps = new Map();
    this.buckets = new Map();
    this.locks = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000;
    
    // Periodic cleanup of expired entries
    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);
  }

  async _acquireLock(key) {
    while (this.locks.get(key)) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    this.locks.set(key, true);
  }

  _releaseLock(key) {
    this.locks.delete(key);
  }

  // Atomic increment for sliding window - prevents race conditions
  async atomicIncrement(key, now, windowStart, windowMs) {
    await this._acquireLock(key);
    
    try {
      let timestamps = this.timestamps.get(key) || [];
      
      // Remove old entries
      timestamps = timestamps.filter(ts => ts > windowStart);
      
      // Add new timestamp
      timestamps.push(now);
      
      this.timestamps.set(key, timestamps);
      
      return { count: timestamps.length };
    } finally {
      this._releaseLock(key);
    }
  }

  // Atomic token bucket operation - prevents race conditions
  async atomicTokenBucket(key, now, bucketSize, refillRate, tokensRequired) {
    await this._acquireLock(key);
    
    try {
      let bucket = this.buckets.get(key);
      
      if (!bucket) {
        bucket = {
          tokens: bucketSize,
          lastRefill: now
        };
      }

      // Calculate tokens to add based on time elapsed
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = (elapsed / 1000) * refillRate;
      bucket.tokens = Math.min(bucketSize, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      let allowed = false;
      if (bucket.tokens >= tokensRequired) {
        bucket.tokens -= tokensRequired;
        allowed = true;
      }

      this.buckets.set(key, bucket);
      
      return { allowed, tokens: bucket.tokens };
    } finally {
      this._releaseLock(key);
    }
  }

  async getTimestamps(key) {
    return this.timestamps.get(key) || [];
  }

  async addTimestamp(key, timestamp, ttl) {
    const timestamps = this.timestamps.get(key) || [];
    timestamps.push(timestamp);
    this.timestamps.set(key, timestamps);
  }

  async removeOldEntries(key, windowStart) {
    const timestamps = this.timestamps.get(key) || [];
    const filtered = timestamps.filter(ts => ts > windowStart);
    this.timestamps.set(key, filtered);
  }

  async clear(key) {
    this.timestamps.delete(key);
  }

  async getBucket(key) {
    return this.buckets.get(key) || null;
  }

  async setBucket(key, bucket) {
    this.buckets.set(key, bucket);
  }

  async deleteBucket(key) {
    this.buckets.delete(key);
  }

  _cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, timestamps] of this.timestamps.entries()) {
      const filtered = timestamps.filter(ts => now - ts < maxAge);
      if (filtered.length === 0) {
        this.timestamps.delete(key);
      } else {
        this.timestamps.set(key, filtered);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupTimer);
    this.timestamps.clear();
    this.buckets.clear();
    this.locks.clear();
  }
}

module.exports = { MemoryStore };
