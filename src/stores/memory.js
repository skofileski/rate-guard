const { BaseStore } = require('./base');

/**
 * In-memory store adapter using Map
 * Suitable for single-instance applications
 */
class MemoryStore extends BaseStore {
  constructor(options = {}) {
    super(options);
    this.store = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000;
    this.cleanupTimer = null;
    this.hits = 0;
    this.misses = 0;
  }

  async _connect() {
    // Start cleanup interval
    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup().catch(() => {});
      }, this.cleanupInterval);
      
      // Don't prevent process exit
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  async _disconnect() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }

  async get(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const entry = this.store.get(prefixedKey);
    
    if (!entry) {
      this.misses++;
      return 0;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(prefixedKey);
      this.misses++;
      return 0;
    }
    
    this.hits++;
    return entry.count;
  }

  async increment(key, windowMs) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const now = Date.now();
    let entry = this.store.get(prefixedKey);
    
    if (!entry || now > entry.expiresAt) {
      entry = {
        count: 0,
        createdAt: now,
        expiresAt: now + windowMs
      };
    }
    
    entry.count++;
    entry.lastAccess = now;
    this.store.set(prefixedKey, entry);
    
    return entry.count;
  }

  async reset(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    this.store.delete(prefixedKey);
  }

  async getTTL(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const entry = this.store.get(prefixedKey);
    
    if (!entry) {
      return -1;
    }
    
    const ttl = entry.expiresAt - Date.now();
    return ttl > 0 ? ttl : -1;
  }

  async cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  async getStats() {
    const baseStats = await super.getStats();
    return {
      ...baseStats,
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 
        ? (this.hits / (this.hits + this.misses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Get all keys matching a pattern (for debugging)
   * @param {string} pattern
   * @returns {Promise<string[]>}
   */
  async keys(pattern = '*') {
    await this.ensureConnection();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keys = [];
    
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }
    
    return keys;
  }
}

module.exports = { MemoryStore };
