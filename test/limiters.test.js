const { SlidingWindowLimiter, TokenBucketLimiter } = require('../src/limiters');
const MemoryStore = require('../src/stores/memory');

describe('SlidingWindowLimiter', () => {
  let store;
  let limiter;

  beforeEach(() => {
    store = new MemoryStore();
    limiter = new SlidingWindowLimiter(store, {
      windowMs: 1000,
      maxRequests: 5
    });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should allow requests within limit', async () => {
    const result = await limiter.isAllowed('test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('should block requests over limit', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.isAllowed('test-key');
    }
    const result = await limiter.isAllowed('test-key');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle corrupted timestamp data', async () => {
    // Simulate corrupted data
    await store.set('corrupted-key', { timestamps: [null, undefined, 'invalid', NaN] });
    const result = await limiter.isAllowed('corrupted-key');
    expect(result.allowed).toBe(true);
  });

  test('should handle missing timestamps array', async () => {
    await store.set('no-array-key', { foo: 'bar' });
    const result = await limiter.isAllowed('no-array-key');
    expect(result.allowed).toBe(true);
  });

  test('should reset key', async () => {
    await limiter.isAllowed('reset-key');
    await limiter.reset('reset-key');
    const data = await store.get('reset-key');
    expect(data).toBeNull();
  });
});

describe('TokenBucketLimiter', () => {
  let store;
  let limiter;

  beforeEach(() => {
    store = new MemoryStore();
    limiter = new TokenBucketLimiter(store, {
      bucketSize: 5,
      refillRate: 10
    });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should allow requests when tokens available', async () => {
    const result = await limiter.isAllowed('test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('should block when no tokens', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.isAllowed('test-key');
    }
    const result = await limiter.isAllowed('test-key');
    expect(result.allowed).toBe(false);
  });

  test('should handle corrupted token data', async () => {
    await store.set('corrupted-key', { tokens: NaN, lastRefill: 'invalid' });
    const result = await limiter.isAllowed('corrupted-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('should handle missing token fields', async () => {
    await store.set('missing-fields', { unrelated: 'data' });
    const result = await limiter.isAllowed('missing-fields');
    expect(result.allowed).toBe(true);
  });

  test('should consume multiple tokens', async () => {
    const result = await limiter.isAllowed('multi-key', 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});
