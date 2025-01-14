/**
 * Store Factory
 * Factory pattern for creating and managing storage backends
 */

const MemoryStore = require('./memory');
const RedisStore = require('./redis');
const MongoStore = require('./mongo');
const { ConfigurationError } = require('../utils/errors');

const STORE_TYPES = {
  memory: MemoryStore,
  redis: RedisStore,
  mongo: MongoStore,
  mongodb: MongoStore
};

class StoreFactory {
  constructor() {
    this.instances = new Map();
    this.customStores = new Map();
  }

  /**
   * Register a custom store type
   * @param {string} name - Store type name
   * @param {Function} StoreClass - Store class constructor
   */
  register(name, StoreClass) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ConfigurationError('Store name must be a non-empty string');
    }
    
    if (typeof StoreClass !== 'function') {
      throw new ConfigurationError('Store class must be a constructor function');
    }

    // Validate that it has required methods
    const requiredMethods = ['get', 'set', 'increment', 'reset', 'close'];
    const proto = StoreClass.prototype;
    
    for (const method of requiredMethods) {
      if (typeof proto[method] !== 'function') {
        throw new ConfigurationError(
          `Custom store must implement '${method}' method`
        );
      }
    }

    this.customStores.set(name.toLowerCase(), StoreClass);
    return this;
  }

  /**
   * Create or retrieve a store instance
   * @param {string|Object} config - Store type string or configuration object
   * @returns {Object} Store instance
   */
  create(config) {
    // Handle string shorthand
    if (typeof config === 'string') {
      config = { type: config };
    }

    const { type = 'memory', name, ...options } = config;
    const normalizedType = type.toLowerCase();
    
    // Check for singleton instance
    const instanceKey = name || `${normalizedType}:${JSON.stringify(options)}`;
    
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey);
    }

    // Get store class
    const StoreClass = this.customStores.get(normalizedType) || 
                       STORE_TYPES[normalizedType];

    if (!StoreClass) {
      const available = [
        ...Object.keys(STORE_TYPES),
        ...this.customStores.keys()
      ].join(', ');
      
      throw new ConfigurationError(
        `Unknown store type: '${type}'. Available types: ${available}`
      );
    }

    // Create instance
    const instance = new StoreClass(options);
    
    // Cache if named or if caching is enabled
    if (name || options.cache !== false) {
      this.instances.set(instanceKey, instance);
    }

    return instance;
  }

  /**
   * Get an existing store instance by name
   * @param {string} name - Instance name
   * @returns {Object|undefined} Store instance
   */
  get(name) {
    return this.instances.get(name);
  }

  /**
   * Close a specific store instance
   * @param {string} name - Instance name
   */
  async close(name) {
    const instance = this.instances.get(name);
    if (instance) {
      await instance.close();
      this.instances.delete(name);
    }
  }

  /**
   * Close all store instances
   */
  async closeAll() {
    const closePromises = [];
    
    for (const [name, instance] of this.instances) {
      closePromises.push(
        instance.close().then(() => {
          this.instances.delete(name);
        })
      );
    }

    await Promise.all(closePromises);
  }

  /**
   * Get list of available store types
   * @returns {string[]} Available store types
   */
  getAvailableTypes() {
    return [
      ...Object.keys(STORE_TYPES),
      ...this.customStores.keys()
    ];
  }

  /**
   * Check if a store type is available
   * @param {string} type - Store type
   * @returns {boolean}
   */
  hasType(type) {
    const normalized = type.toLowerCase();
    return STORE_TYPES.hasOwnProperty(normalized) || 
           this.customStores.has(normalized);
  }

  /**
   * Get statistics about managed instances
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      instanceCount: this.instances.size,
      customStoreTypes: this.customStores.size,
      instances: Array.from(this.instances.keys())
    };
  }
}

// Export singleton instance
const factory = new StoreFactory();

module.exports = factory;
module.exports.StoreFactory = StoreFactory;
