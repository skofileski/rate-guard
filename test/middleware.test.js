const { RateLimitMiddleware, createMiddleware } = require('../src/middleware');
const { MemoryStore } = require('../src/stores/memory');

describe('RateLimitMiddleware', () => {
  let store;

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('Express middleware', () => {
    it('should allow requests under the limit', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 5,
        windowMs: 60000
      });

      const req = { ip: '127.0.0.1', path: '/api/test', method: 'GET', headers: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await middleware.express()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    it('should block requests over the limit', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 2,
        windowMs: 60000
      });

      const req = { ip: '127.0.0.1', path: '/api/test', method: 'GET', headers: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const expressMiddleware = middleware.express();

      // Make requests up to and over the limit
      await expressMiddleware(req, res, next);
      await expressMiddleware(req, res, next);
      await expressMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too Many Requests'
      }));
    });

    it('should skip requests when skip function returns true', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 1,
        windowMs: 60000,
        skip: (req) => req.path === '/health'
      });

      const req = { ip: '127.0.0.1', path: '/health', method: 'GET', headers: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const expressMiddleware = middleware.express();

      await expressMiddleware(req, res, next);
      await expressMiddleware(req, res, next);
      await expressMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 5,
        windowMs: 60000,
        keyGenerator: (req) => `user:${req.headers['x-user-id']}`
      });

      const req1 = { ip: '127.0.0.1', path: '/api', method: 'GET', headers: { 'x-user-id': 'user1' } };
      const req2 = { ip: '127.0.0.1', path: '/api', method: 'GET', headers: { 'x-user-id': 'user2' } };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const expressMiddleware = middleware.express();

      await expressMiddleware(req1, res, next);
      await expressMiddleware(req2, res, next);

      // Both should pass as they have different keys
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should call custom onRateLimited handler', async () => {
      const onRateLimited = jest.fn((req, res, next, result) => {
        res.status(503).json({ custom: 'response' });
      });

      const middleware = createMiddleware({
        store,
        maxRequests: 1,
        windowMs: 60000,
        onRateLimited
      });

      const req = { ip: '127.0.0.1', path: '/api', method: 'GET', headers: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const expressMiddleware = middleware.express();

      await expressMiddleware(req, res, next);
      await expressMiddleware(req, res, next);

      expect(onRateLimited).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Koa middleware', () => {
    it('should allow requests under the limit', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 5,
        windowMs: 60000
      });

      const ctx = {
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
        headers: {},
        state: {},
        set: jest.fn()
      };
      const next = jest.fn();

      await middleware.koa()(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.set).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    });

    it('should block requests over the limit', async () => {
      const middleware = createMiddleware({
        store,
        maxRequests: 1,
        windowMs: 60000
      });

      const ctx = {
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
        headers: {},
        state: {},
        set: jest.fn()
      };
      const next = jest.fn();

      const koaMiddleware = middleware.koa();

      await koaMiddleware(ctx, next);
      await koaMiddleware(ctx, next);

      expect(ctx.status).toBe(429);
      expect(ctx.body).toEqual(expect.objectContaining({
        error: 'Too Many Requests'
      }));
    });
  });

  describe('createMiddleware factory', () => {
    it('should create middleware with default options', () => {
      const middleware = createMiddleware();
      
      expect(middleware).toBeInstanceOf(RateLimitMiddleware);
      expect(middleware.express).toBeDefined();
      expect(middleware.koa).toBeDefined();
    });

    it('should create middleware with token bucket algorithm', () => {
      const middleware = createMiddleware({
        algorithm: 'token-bucket',
        bucketSize: 10,
        tokensPerInterval: 1,
        interval: 1000
      });

      expect(middleware).toBeInstanceOf(RateLimitMiddleware);
    });
  });
});
