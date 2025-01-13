const { BaseStore } = require('./base');

/**
 * Redis store adapter
 * Suitable for distributed applications
 */
class RedisStore extends BaseStore {
  constructor(options = {}) {
    super(options);
    this.client = options.client || null;
    this.host = options.host || 'localhost';
    this.port = options.port || 6379;
    this.password = options.password || null;
    this.db = options.db || 0;
    this.enableOfflineQueue = options.enableOfflineQueue !== false;
    this.maxRetriesPerRequest = options.maxRetriesPerRequest || 3;
    this.ownClient = false;
  }

  async _connect() {
    if (this.client) {
      // Using provided client
      this.ownClient = false;
      return;
    }

    // Lazy load redis to make it optional
    let Redis;
    try {
      Redis = require('ioredis');
    } catch (e) {
      throw new Error('ioredis is required for RedisStore. Install it with: npm install ioredis');
    }

    this.client = new Redis({
      host: this.host,
      port: this.port,
      password: this.password,
      db: this.db,
      enableOfflineQueue: this.enableOfflineQueue,
      maxRetriesPerRequest: this.maxRetriesPerRequest,
      lazyConnect: true
    });

    this.ownClient = true;
    await this.client.connect();
  }

  async _disconnect() {
    if (this.client && this.ownClient) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const value = await this.client.get(prefixedKey);
    return value ? parseInt(value, 10) : 0;
  }

  async increment(key, windowMs) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const ttlSeconds = Math.ceil(windowMs / 1000);
    
    // Use Lua script for atomic increment with TTL
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;
    
    const result = await this.client.eval(script, 1, prefixedKey, ttlSeconds);
    return parseInt(result, 10);
  }

  async reset(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    await this.client.del(prefixedKey);
  }

  async getTTL(key) {
    await this.ensureConnection();
    const prefixedKey = this.prefixKey(key);
    const ttl = await this.client.pttl(prefixedKey);
    return ttl > 0 ? ttl : -1;
  }

  /**
   * Reset multiple keys by pattern
   * @param {string} pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async resetPattern(pattern) {
    await this.ensureConnection();
    const prefixedPattern = this.prefixKey(pattern);
    
    let cursor = '0';
    let deleted = 0;
    
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        prefixedPattern,
        'COUNT',
        100
      );
      
      cursor = newCursor;
      
      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        deleted += result;
      }
    } while (cursor !== '0');
    
    return deleted;
  }

  async getStats() {
    await this.ensureConnection();
    const baseStats = await super.getStats();
    
    try {
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      
      return {
        ...baseStats,
        host: this.host,
        port: this.port,
        db: this.db,
        memory: memoryMatch ? memoryMatch[1] : 'unknown'
      };
    } catch (e) {
      return {
        ...baseStats,
        host: this.host,
        port: this.port,
        db: this.db
      };
    }
  }

  /**
   * Batch increment for multiple keys
   * @param {Array<{key: string, windowMs: number}>} items
   * @returns {Promise<number[]>}
   */
  async batchIncrement(items) {
    await this.ensureConnection();
    const pipeline = this.client.pipeline();
    
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;
    
    for (const { key, windowMs } of items) {
      const prefixedKey = this.prefixKey(key);
      const ttlSeconds = Math.ceil(windowMs / 1000);
      pipeline.eval(script, 1, prefixedKey, ttlSeconds);
    }
    
    const results = await pipeline.exec();
    return results.map(([err, result]) => {
      if (err) throw err;
      return parseInt(result, 10);
    });
  }
}

module.exports = { RedisStore };
