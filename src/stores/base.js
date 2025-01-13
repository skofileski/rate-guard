/**
 * Base store adapter class
 * Provides common interface and utilities for all storage backends
 */
class BaseStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rg:';
    this.connected = false;
    this.connectionPromise = null;
  }

  /**
   * Generate a prefixed key
   * @param {string} key - The raw key
   * @returns {string} Prefixed key
   */
  prefixKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Connect to the store
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      return;
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    this.connectionPromise = this._connect();
    await this.connectionPromise;
    this.connected = true;
    this.connectionPromise = null;
  }

  /**
   * Internal connect method - override in subclasses
   * @returns {Promise<void>}
   */
  async _connect() {
    // Override in subclasses
  }

  /**
   * Disconnect from the store
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }
    await this._disconnect();
    this.connected = false;
  }

  /**
   * Internal disconnect method - override in subclasses
   * @returns {Promise<void>}
   */
  async _disconnect() {
    // Override in subclasses
  }

  /**
   * Ensure connection before operation
   * @returns {Promise<void>}
   */
  async ensureConnection() {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Get current count for a key
   * @param {string} key
   * @returns {Promise<number>}
   */
  async get(key) {
    throw new Error('Method get() must be implemented');
  }

  /**
   * Increment count for a key
   * @param {string} key
   * @param {number} windowMs
   * @returns {Promise<number>}
   */
  async increment(key, windowMs) {
    throw new Error('Method increment() must be implemented');
  }

  /**
   * Reset count for a key
   * @param {string} key
   * @returns {Promise<void>}
   */
  async reset(key) {
    throw new Error('Method reset() must be implemented');
  }

  /**
   * Get time-to-live for a key in milliseconds
   * @param {string} key
   * @returns {Promise<number>}
   */
  async getTTL(key) {
    throw new Error('Method getTTL() must be implemented');
  }

  /**
   * Clean up expired entries
   * @returns {Promise<number>} Number of entries cleaned
   */
  async cleanup() {
    return 0;
  }

  /**
   * Get store statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return {
      type: this.constructor.name,
      connected: this.connected,
      prefix: this.prefix
    };
  }
}

module.exports = { BaseStore };
