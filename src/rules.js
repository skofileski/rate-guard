/**
 * Rule Engine for customizable rate limit rules
 * Supports per-route and per-user-tier configurations
 */

class RuleEngine {
  constructor(defaultRule = {}) {
    this.defaultRule = {
      windowMs: 60000,
      maxRequests: 100,
      algorithm: 'sliding-window',
      ...defaultRule
    };
    this.routeRules = new Map();
    this.tierRules = new Map();
  }

  /**
   * Set rate limit rule for a specific route
   * @param {string|RegExp} route - Route pattern
   * @param {Object} rule - Rate limit configuration
   */
  setRouteRule(route, rule) {
    const normalizedRoute = route instanceof RegExp ? route : new RegExp(`^${route}$`);
    this.routeRules.set(normalizedRoute, { ...this.defaultRule, ...rule });
    return this;
  }

  /**
   * Set rate limit rule for a user tier
   * @param {string} tier - User tier name (e.g., 'free', 'pro', 'enterprise')
   * @param {Object} rule - Rate limit configuration
   */
  setTierRule(tier, rule) {
    this.tierRules.set(tier.toLowerCase(), { ...this.defaultRule, ...rule });
    return this;
  }

  /**
   * Get the applicable rule for a request
   * @param {string} route - Request route
   * @param {string} [tier] - User tier
   * @returns {Object} The most specific matching rule
   */
  getRule(route, tier = null) {
    let rule = { ...this.defaultRule };

    // Check route-specific rules
    for (const [pattern, routeRule] of this.routeRules) {
      if (pattern.test(route)) {
        rule = { ...rule, ...routeRule };
        break;
      }
    }

    // Apply tier-specific overrides
    if (tier && this.tierRules.has(tier.toLowerCase())) {
      const tierRule = this.tierRules.get(tier.toLowerCase());
      rule = { ...rule, ...tierRule };
    }

    return rule;
  }

  /**
   * Generate a unique key for rate limiting
   * @param {Object} options - Key generation options
   * @returns {string} Rate limit key
   */
  generateKey({ ip, userId, route, tier }) {
    const identifier = userId || ip || 'anonymous';
    const tierPart = tier ? `:${tier}` : '';
    const routePart = route ? `:${this.normalizeRoute(route)}` : '';
    return `ratelimit:${identifier}${tierPart}${routePart}`;
  }

  /**
   * Normalize route for key generation
   * @param {string} route - Route path
   * @returns {string} Normalized route
   */
  normalizeRoute(route) {
    return route
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .replace(/\/:[^/]+/g, '/:param')
      .toLowerCase();
  }

  /**
   * Clear all rules
   */
  clearRules() {
    this.routeRules.clear();
    this.tierRules.clear();
  }

  /**
   * Get all configured rules for debugging
   * @returns {Object} All rules
   */
  getAllRules() {
    const routes = {};
    for (const [pattern, rule] of this.routeRules) {
      routes[pattern.toString()] = rule;
    }

    const tiers = {};
    for (const [tier, rule] of this.tierRules) {
      tiers[tier] = rule;
    }

    return {
      default: this.defaultRule,
      routes,
      tiers
    };
  }
}

module.exports = { RuleEngine };
