const { TierManager, createTierManager, DEFAULT_TIERS } = require('../src/tiers');

describe('TierManager', () => {
  let tierManager;

  beforeEach(() => {
    tierManager = new TierManager();
  });

  describe('constructor', () => {
    it('should initialize with default tiers', () => {
      const tiers = tierManager.listTiers();
      expect(tiers).toContain('free');
      expect(tiers).toContain('basic');
      expect(tiers).toContain('premium');
      expect(tiers).toContain('enterprise');
    });

    it('should accept custom tiers', () => {
      const manager = new TierManager({
        vip: { maxRequests: 50000 }
      });
      expect(manager.listTiers()).toContain('vip');
    });
  });

  describe('defineTier', () => {
    it('should add a new tier', () => {
      tierManager.defineTier('custom', { maxRequests: 5000 });
      expect(tierManager.listTiers()).toContain('custom');
    });

    it('should throw for invalid tier name', () => {
      expect(() => tierManager.defineTier('', {})).toThrow();
      expect(() => tierManager.defineTier(null, {})).toThrow();
    });

    it('should set default values for missing properties', () => {
      tierManager.defineTier('partial', { maxRequests: 300 });
      const limits = tierManager.getTierLimits('partial');
      expect(limits.windowMs).toBe(60000);
      expect(limits.maxRequests).toBe(300);
    });
  });

  describe('removeTier', () => {
    it('should remove custom tier', () => {
      tierManager.defineTier('temp', { maxRequests: 100 });
      tierManager.removeTier('temp');
      expect(tierManager.listTiers()).not.toContain('temp');
    });

    it('should throw when removing default tier', () => {
      expect(() => tierManager.removeTier('free')).toThrow();
    });
  });

  describe('user tier management', () => {
    it('should assign user to tier', () => {
      tierManager.setUserTier('user-1', 'premium');
      expect(tierManager.getUserTier('user-1')).toBe('premium');
    });

    it('should return free tier for unknown users', () => {
      expect(tierManager.getUserTier('unknown')).toBe('free');
    });

    it('should throw for unknown tier assignment', () => {
      expect(() => tierManager.setUserTier('user-1', 'nonexistent')).toThrow();
    });

    it('should bulk assign users', () => {
      tierManager.bulkAssign({
        'user-1': 'basic',
        'user-2': 'premium'
      });
      expect(tierManager.getUserTier('user-1')).toBe('basic');
      expect(tierManager.getUserTier('user-2')).toBe('premium');
    });

    it('should clear all assignments', () => {
      tierManager.setUserTier('user-1', 'premium');
      tierManager.clearAssignments();
      expect(tierManager.getUserTier('user-1')).toBe('free');
    });
  });

  describe('resolveTier', () => {
    it('should resolve tier from user map', async () => {
      tierManager.setUserTier('user-1', 'enterprise');
      const result = await tierManager.resolveTier({}, 'user-1');
      expect(result.name).toBe('enterprise');
      expect(result.maxRequests).toBe(10000);
    });

    it('should use custom resolver when set', async () => {
      tierManager.setTierResolver(async (req) => {
        return req.headers?.['x-api-tier'] || 'free';
      });

      const req = { headers: { 'x-api-tier': 'premium' } };
      const result = await tierManager.resolveTier(req, 'user-1');
      expect(result.name).toBe('premium');
    });

    it('should fallback to free on resolver error', async () => {
      tierManager.setTierResolver(async () => {
        throw new Error('Resolver failed');
      });

      const result = await tierManager.resolveTier({}, 'user-1');
      expect(result.name).toBe('free');
    });

    it('should throw for invalid resolver', () => {
      expect(() => tierManager.setTierResolver('not a function')).toThrow();
    });
  });

  describe('createTierManager helper', () => {
    it('should create a TierManager instance', () => {
      const manager = createTierManager();
      expect(manager).toBeInstanceOf(TierManager);
    });

    it('should accept custom tiers', () => {
      const manager = createTierManager({ ultra: { maxRequests: 100000 } });
      expect(manager.listTiers()).toContain('ultra');
    });
  });

  describe('DEFAULT_TIERS', () => {
    it('should have correct structure', () => {
      expect(DEFAULT_TIERS.free).toBeDefined();
      expect(DEFAULT_TIERS.free.maxRequests).toBe(100);
      expect(DEFAULT_TIERS.premium.maxRequests).toBe(2000);
    });
  });
});
