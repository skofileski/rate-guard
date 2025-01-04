/**
 * Configuration loader for rate-guard
 * Supports environment variables and custom config objects
 */

const defaults = {
  // Default rate limit settings
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  
  // Token bucket defaults
  bucketSize: 100,
  refillRate: 10, // tokens per second
  
  // Storage defaults
  store: 'memory',
  
  // Redis configuration
  redis: {
    host: 'localhost',
    port: 6379,
    password: null,
    db: 0,
    keyPrefix: 'rate-guard:'
  },
  
  // MongoDB configuration
  mongo: {
    uri: 'mongodb://localhost:27017',
    dbName: 'rate-guard',
    collectionName: 'rate_limits'
  },
  
  // Response settings
  statusCode: 429,
  message: 'Too many requests, please try again later.',
  headers: true,
  
  // Skip/whitelist settings
  skip: null,
  keyGenerator: null,
  
  // Logging
  enableLogging: false
};

function loadFromEnv() {
  const env = process.env;
  
  return {
    windowMs: env.RATE_GUARD_WINDOW_MS ? parseInt(env.RATE_GUARD_WINDOW_MS, 10) : undefined,
    maxRequests: env.RATE_GUARD_MAX_REQUESTS ? parseInt(env.RATE_GUARD_MAX_REQUESTS, 10) : undefined,
    bucketSize: env.RATE_GUARD_BUCKET_SIZE ? parseInt(env.RATE_GUARD_BUCKET_SIZE, 10) : undefined,
    refillRate: env.RATE_GUARD_REFILL_RATE ? parseInt(env.RATE_GUARD_REFILL_RATE, 10) : undefined,
    store: env.RATE_GUARD_STORE,
    redis: {
      host: env.RATE_GUARD_REDIS_HOST,
      port: env.RATE_GUARD_REDIS_PORT ? parseInt(env.RATE_GUARD_REDIS_PORT, 10) : undefined,
      password: env.RATE_GUARD_REDIS_PASSWORD,
      db: env.RATE_GUARD_REDIS_DB ? parseInt(env.RATE_GUARD_REDIS_DB, 10) : undefined
    },
    mongo: {
      uri: env.RATE_GUARD_MONGO_URI,
      dbName: env.RATE_GUARD_MONGO_DB
    },
    enableLogging: env.RATE_GUARD_LOGGING === 'true'
  };
}

function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) continue;
    
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

function createConfig(userConfig = {}) {
  const envConfig = loadFromEnv();
  
  // Merge: defaults <- env <- user config
  let config = deepMerge(defaults, envConfig);
  config = deepMerge(config, userConfig);
  
  return Object.freeze(config);
}

function validateConfig(config) {
  const errors = [];
  
  if (config.windowMs <= 0) {
    errors.push('windowMs must be a positive number');
  }
  
  if (config.maxRequests <= 0) {
    errors.push('maxRequests must be a positive number');
  }
  
  if (config.bucketSize <= 0) {
    errors.push('bucketSize must be a positive number');
  }
  
  if (config.refillRate <= 0) {
    errors.push('refillRate must be a positive number');
  }
  
  if (!['memory', 'redis', 'mongo'].includes(config.store)) {
    errors.push('store must be one of: memory, redis, mongo');
  }
  
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  defaults,
  createConfig,
  validateConfig,
  loadFromEnv
};
