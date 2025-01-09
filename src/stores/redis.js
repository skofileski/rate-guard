/**
 * Redis storage adapter for rate limiting
 */

class RedisStore {
  constructor(options = {}) {
    this.client = options.client;
    this.prefix = options.prefix || 'ratelimit:';
    
    if (!this.client) {
      throw new Error('Redis client is required');
    }
  }

  _key(key, suffix = '') {
    return `${this.prefix}${key}${suffix}`;
  }

  // Atomic increment using Lua script - prevents race conditions
  async atomicIncrement(key, now, windowStart, windowMs) {
    const redisKey = this._key(key, ':sw');
    const ttlSeconds = Math.ceil(windowMs / 1000);
    
    // Lua script for atomic sliding window operation
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local ttl = tonumber(ARGV[3])
      
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
      
      -- Add new entry
      redis.call('ZADD', key, now, now .. ':' .. math.random())
      
      -- Set expiry
      redis.call('EXPIRE', key, ttl)
      
      -- Get count
      local count = redis.call('ZCARD', key)
      
      return count
    `;
    
    const count = await this.client.eval(
      script,
      1,
      redisKey,
      now.toString(),
      windowStart.toString(),
      ttlSeconds.toString()
    );
    
    return { count };
  }

  // Atomic token bucket using Lua script - prevents race conditions
  async atomicTokenBucket(key, now, bucketSize, refillRate, tokensRequired) {
    const redisKey = this._key(key, ':tb');
    
    // Lua script for atomic token bucket operation
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local bucketSize = tonumber(ARGV[2])
      local refillRate = tonumber(ARGV[3])
      local tokensRequired = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or bucketSize
      local lastRefill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add
      local elapsed = now - lastRefill
      local tokensToAdd = (elapsed / 1000) * refillRate
      tokens = math.min(bucketSize, tokens + tokensToAdd)
      
      local allowed = 0
      if tokens >= tokensRequired then
        tokens = tokens - tokensRequired
        allowed = 1
      end
      
      redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
      redis.call('EXPIRE', key, 3600)
      
      return {allowed, tokens}
    `;
    
    const result = await this.client.eval(
      script,
      1,
      redisKey,
      now.toString(),
      bucketSize.toString(),
      refillRate.toString(),
      tokensRequired.toString()
    );
    
    return { allowed: result[0] === 1, tokens: result[1] };
  }

  async getTimestamps(key) {
    const redisKey = this._key(key, ':sw');
    const entries = await this.client.zrange(redisKey, 0, -1, 'WITHSCORES');
    const timestamps = [];
    for (let i = 1; i < entries.length; i += 2) {
      timestamps.push(parseFloat(entries[i]));
    }
    return timestamps;
  }

  async addTimestamp(key, timestamp, ttl) {
    const redisKey = this._key(key, ':sw');
    const uniqueId = `${timestamp}:${Math.random()}`;
    await this.client.zadd(redisKey, timestamp, uniqueId);
    await this.client.pexpire(redisKey, ttl);
  }

  async removeOldEntries(key, windowStart) {
    const redisKey = this._key(key, ':sw');
    await this.client.zremrangebyscore(redisKey, '-inf', windowStart);
  }

  async clear(key) {
    await this.client.del(this._key(key, ':sw'));
  }

  async getBucket(key) {
    const redisKey = this._key(key, ':tb');
    const data = await this.client.hgetall(redisKey);
    if (!data || !data.tokens) return null;
    return {
      tokens: parseFloat(data.tokens),
      lastRefill: parseInt(data.lastRefill, 10)
    };
  }

  async setBucket(key, bucket) {
    const redisKey = this._key(key, ':tb');
    await this.client.hmset(redisKey, {
      tokens: bucket.tokens.toString(),
      lastRefill: bucket.lastRefill.toString()
    });
    await this.client.expire(redisKey, 3600);
  }

  async deleteBucket(key) {
    await this.client.del(this._key(key, ':tb'));
  }

  async destroy() {
    // Redis client cleanup is handled externally
  }
}

module.exports = { RedisStore };
