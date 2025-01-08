/**
 * User tier management for differentiated rate limits
 */

const DEFAULT_TIERS = {
  free: {
    windowMs: 60000,
    maxRequests: 100,
    tokenBucketSize: 10,
    tokenRefillRate: 1
  },
  basic: {
    windowMs: 60000,
    maxRequests: 500,
    tokenBucketSize: 50,
    tokenRefillRate: 5
  },
  premium: {
    windowMs: 60000,
    maxRequests: 2000,
    tokenBucketSize: 200,
    tokenRefillRate: 20
  },
  enterprise: {
    windowMs: 60000,
    maxRequests: 10000,
    tokenBucketSize: 1000,
    tokenRefillRate: 100
  }
};

class TierManager {
  constructor(customTiers = {}) {
    this.tiers = { ...DEFAULT_TIERS, ...customTiers };
    this.userTierMap = new Map();
    this.tierResolver = null;
  }

  /**
   * Define a custom tier
   * @param {string} tierName - Name of the tier
   * @param {Object} limits - Rate limit configuration for the tier
   */
  defineTier(tierName, limits) {
    if (!tierName || typeof tierName !== 'string') {
      throw new Error('Tier name must be a non-empty string');
    }
    
    this.tiers[tierName] = {
      windowMs: limits.windowMs || 60000,
      maxRequests: limits.maxRequests || 100,
      tokenBucketSize: limits.tokenBucketSize || 10,
      tokenRefillRate: limits.tokenRefillRate || 1,
      ...limits
    };
    
    return this;
  }

  /**
   * Remove a tier definition
   * @param {string} tierName - Name of the tier to remove
   */
  removeTier(tierName) {
    if (DEFAULT_TIERS[tierName]) {
      throw new Error(`Cannot remove default tier: ${tierName}`);
    }
    delete this.tiers[tierName];
    return this;
  }

  /**
   * Assign a user to a specific tier
   * @param {string} userId - User identifier
   * @param {string} tierName - Tier to assign
   */
  setUserTier(userId, tierName) {
    if (!this.tiers[tierName]) {
      throw new Error(`Unknown tier: ${tierName}`);
    }
    this.userTierMap.set(userId, tierName);
    return this;
  }

  /**
   * Get the tier for a specific user
   * @param {string} userId - User identifier
   * @returns {string} Tier name
   */
  getUserTier(userId) {
    return this.userTierMap.get(userId) || 'free';
  }

  /**
   * Set a custom resolver function for determining user tiers
   * @param {Function} resolver - Async function that receives request and returns tier name
   */
  setTierResolver(resolver) {
    if (typeof resolver !== 'function') {
      throw new Error('Tier resolver must be a function');
    }
    this.tierResolver = resolver;
    return this;
  }

  /**
   * Resolve the tier for a request
   * @param {Object} req - Request object
   * @param {string} identifier - User/client identifier
   * @returns {Promise<Object>} Tier configuration
   */
  async resolveTier(req, identifier) {
    let tierName = 'free';
    
    if (this.tierResolver) {
      try {
        tierName = await this.tierResolver(req, identifier);
      } catch (error) {
        console.error('Tier resolver error:', error.message);
        tierName = 'free';
      }
    } else if (identifier && this.userTierMap.has(identifier)) {
      tierName = this.userTierMap.get(identifier);
    }
    
    const tier = this.tiers[tierName] || this.tiers.free;
    
    return {
      name: tierName,
      ...tier
    };
  }

  /**
   * Get limits for a specific tier
   * @param {string} tierName - Tier name
   * @returns {Object} Tier limits
   */
  getTierLimits(tierName) {
    return this.tiers[tierName] || this.tiers.free;
  }

  /**
   * List all available tiers
   * @returns {string[]} Array of tier names
   */
  listTiers() {
    return Object.keys(this.tiers);
  }

  /**
   * Get all tier configurations
   * @returns {Object} All tier configurations
   */
  getAllTiers() {
    return { ...this.tiers };
  }

  /**
   * Bulk assign users to tiers
   * @param {Object} assignments - Object mapping userIds to tier names
   */
  bulkAssign(assignments) {
    for (const [userId, tierName] of Object.entries(assignments)) {
      this.setUserTier(userId, tierName);
    }
    return this;
  }

  /**
   * Clear all user tier assignments
   */
  clearAssignments() {
    this.userTierMap.clear();
    return this;
  }
}

function createTierManager(customTiers = {}) {
  return new TierManager(customTiers);
}

module.exports = {
  TierManager,
  createTierManager,
  DEFAULT_TIERS
};
