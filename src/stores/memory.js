/**
 * In-memory storage adapter for rate limiting
 */

class MemoryStore {
  constructor(options = {}) {
    this.data = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000;
    this.maxKeys = options.maxKeys || 10000;
    this._cleanupTimer = null;
    
    if (options.autoCleanup !== false) {
      this._startCleanup();
    }
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);
    
    // Allow process to exit even if timer is running
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, value] of this.data.entries()) {
      if (Array.isArray(value)) {
        const filtered = value.filter(ts => ts > now - 3600000);
        if (filtered.length === 0) {
          this.data.delete(key);
        } else {
          this.data.set(key, filtered);
        }
      } else if (value && value.expiresAt && value.expiresAt < now) {
        this.data.delete(key);
      }
    }
    
    // Evict oldest keys if we exceed maxKeys
    if (this.data.size > this.maxKeys) {
      const keysToDelete = this.data.size - this.maxKeys;
      const keys = Array.from(this.data.keys()).slice(0, keysToDelete);
      keys.forEach(key => this.data.delete(key));
    }
  }

  // Sliding window methods
  async add(key, timestamp) {
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }
    this.data.get(key).push(timestamp);
  }

  async count(key, windowStart, windowEnd) {
    const timestamps = this.data.get(key) || [];
    return timestamps.filter(ts => ts >= windowStart && ts <= windowEnd).length;
  }

  async removeExpired(key, windowStart) {
    const timestamps = this.data.get(key);
    if (timestamps) {
      this.data.set(key, timestamps.filter(ts => ts >= windowStart));
    }
  }

  async getOldestTimestamp(key) {
    const timestamps = this.data.get(key) || [];
    if (timestamps.length === 0) return Date.now();
    return Math.min(...timestamps);
  }

  async clear(key) {
    this.data.delete(key);
  }

  // Atomic increment for sliding window (prevents race conditions)
  async atomicIncrement(key, timestamp, windowStart, windowMs) {
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }
    
    const timestamps = this.data.get(key);
    
    // Remove expired entries
    const filtered = timestamps.filter(ts => ts >= windowStart);
    
    // Add new timestamp
    filtered.push(timestamp);
    
    // Store atomically
    this.data.set(key, filtered);
    
    const oldestTs = filtered.length > 0 ? Math.min(...filtered) : timestamp;
    
    return {
      count: filtered.length,
      resetAt: oldestTs + windowMs
    };
  }

  // Token bucket methods
  async get(key) {
    const value = this.data.get(key);
    if (value && !Array.isArray(value)) {
      return value;
    }
    return null;
  }

  async set(key, value) {
    this.data.set(key, value);
  }

  async delete(key) {
    this.data.delete(key);
  }

  // Utility methods
  async size() {
    return this.data.size;
  }

  async reset() {
    this.data.clear();
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this.data.clear();
  }
}

module.exports = { MemoryStore };
