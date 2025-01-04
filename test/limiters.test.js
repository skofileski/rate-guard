const { SlidingWindowLimiter, TokenBucketLimiter, createLimiter } = require('../src/limiters');
const MemoryStore = require('../src/stores/memory');

describe('SlidingWindowLimiter', () => {
  let store;
  let limiter;

  beforeEach(() => {
    store = new MemoryStore();
    limiter = new SlidingWindowLimiter({ windowSize: 1000, maxRequests: 3 });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should allow requests under the limit', async () => {
    const result = await limiter.isAllowed(store, 'test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  test('should block requests over the limit', async () => {
    await limiter.isAllowed(store, 'test-key');
    await limiter.isAllowed(store, 'test-key');
    await limiter.isAllowed(store, 'test-key');
    
    const result = await limiter.isAllowed(store, 'test-key');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle corrupted data gracefully', async () => {
    // Simulate corrupted data
    await store.set('corrupted-key', 'not-an-array');
    
    const result = await limiter.isAllowed(store, 'corrupted-key');
    expect(result.allowed).toBe(true);
  });

  test('should filter out invalid timestamps', async () => {
    // Simulate data with invalid timestamps
    await store.set('invalid-ts-key', [NaN, 'invalid', null, Date.now()]);
    
    const result = await limiter.isAllowed(store, 'invalid-ts-key');
    expect(result.allowed).toBe(true);
  });
});

describe('TokenBucketLimiter', () => {
  let store;
  let limiter;

  beforeEach(() => {
    store = new MemoryStore();
    limiter = new TokenBucketLimiter({ bucketSize: 5, refillRate: 1 });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should allow requests when tokens available', async () => {
    const result = await limiter.isAllowed(store, 'test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('should block requests when no tokens', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.isAllowed(store, 'test-key');
    }
    
    const result = await limiter.isAllowed(store, 'test-key');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle corrupted bucket data', async () => {
    await store.set('corrupted-bucket', { tokens: 'invalid', lastRefill: 'bad' });
    
    const result = await limiter.isAllowed(store, 'corrupted-bucket');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('should handle null bucket data', async () => {
    await store.set('null-bucket', null);
    
    const result = await limiter.isAllowed(store, 'null-bucket');
    expect(result.allowed).toBe(true);
  });
});

describe('createLimiter', () => {
  test('should create sliding window limiter', () => {
    const limiter = createLimiter('sliding-window');
    expect(limiter).toBeInstanceOf(SlidingWindowLimiter);
  });

  test('should create token bucket limiter', () => {
    const limiter = createLimiter('token-bucket');
    expect(limiter).toBeInstanceOf(TokenBucketLimiter);
  });

  test('should throw on unknown type', () => {
    expect(() => createLimiter('unknown')).toThrow('Unknown limiter type');
  });
});
