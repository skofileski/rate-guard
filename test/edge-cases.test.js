const { SlidingWindowLimiter, TokenBucketLimiter } = require('../src/limiters');
const { MemoryStore } = require('../src/stores/memory');

describe('Edge Cases', () => {
  let store;

  beforeEach(() => {
    store = new MemoryStore({ autoCleanup: false });
  });

  afterEach(() => {
    store.destroy();
  });

  describe('TokenBucketLimiter edge cases', () => {
    test('should handle tokensRequired of 0', async () => {
      const limiter = new TokenBucketLimiter(store, {
        bucketSize: 10,
        refillRate: 1,
        refillInterval: 1000
      });

      const result = await limiter.isAllowed('test-key', 0);
      expect(result.allowed).toBe(true);
    });

    test('should handle negative tokensRequired', async () => {
      const limiter = new TokenBucketLimiter(store, {
        bucketSize: 10,
        refillRate: 1,
        refillInterval: 1000
      });

      const result = await limiter.isAllowed('test-key', -5);
      expect(result.allowed).toBe(true);
    });

    test('should reject requests exceeding bucket capacity', async () => {
      const limiter = new TokenBucketLimiter(store, {
        bucketSize: 10,
        refillRate: 1,
        refillInterval: 1000
      });

      const result = await limiter.isAllowed('test-key', 15);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Request exceeds bucket capacity');
    });

    test('should handle corrupted bucket data', async () => {
      const limiter = new TokenBucketLimiter(store, {
        bucketSize: 10,
        refillRate: 1,
        refillInterval: 1000
      });

      // Set corrupted data
      await store.set('test-key', { tokens: NaN, lastRefill: Date.now() });

      const result = await limiter.isAllowed('test-key', 1);
      expect(result.allowed).toBe(true);
      expect(typeof result.remaining).toBe('number');
      expect(isNaN(result.remaining)).toBe(false);
    });

    test('getStatus should return full bucket for new keys', async () => {
      const limiter = new TokenBucketLimiter(store, {
        bucketSize: 10,
        refillRate: 1,
        refillInterval: 1000
      });

      const status = await limiter.getStatus('new-key');
      expect(status.tokens).toBe(10);
      expect(status.bucketSize).toBe(10);
    });
  });

  describe('SlidingWindowLimiter edge cases', () => {
    test('should handle rapid concurrent requests', async () => {
      const limiter = new SlidingWindowLimiter(store, {
        windowMs: 1000,
        maxRequests: 5
      });

      // Simulate concurrent requests
      const results = await Promise.all([
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key')
      ]);

      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(5);
    });

    test('should handle 6th concurrent request correctly', async () => {
      const limiter = new SlidingWindowLimiter(store, {
        windowMs: 1000,
        maxRequests: 5
      });

      // Simulate 6 concurrent requests
      const results = await Promise.all([
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key'),
        limiter.isAllowed('concurrent-key')
      ]);

      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(5);
    });
  });

  describe('createLimiter edge cases', () => {
    const { createLimiter } = require('../src/limiters');

    test('should throw error for missing store', () => {
      expect(() => createLimiter('token-bucket', null)).toThrow('Store is required');
    });

    test('should throw error for unknown limiter type', () => {
      expect(() => createLimiter('unknown-type', store)).toThrow('Unknown limiter type');
    });
  });
});
