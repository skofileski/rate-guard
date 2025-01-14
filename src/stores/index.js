/**
 * Storage Backends Index
 * Central export for all storage-related modules
 */

const BaseStore = require('./base');
const MemoryStore = require('./memory');
const RedisStore = require('./redis');
const MongoStore = require('./mongo');
const factory = require('./factory');
const { StoreFactory } = require('./factory');

/**
 * Create a store instance using the factory
 * @param {string|Object} config - Store configuration
 * @returns {Object} Store instance
 */
function createStore(config) {
  return factory.create(config);
}

/**
 * Register a custom store type
 * @param {string} name - Store type name
 * @param {Function} StoreClass - Store class constructor
 */
function registerStore(name, StoreClass) {
  return factory.register(name, StoreClass);
}

/**
 * Close all managed store instances
 */
async function closeAllStores() {
  return factory.closeAll();
}

module.exports = {
  // Store classes
  BaseStore,
  MemoryStore,
  RedisStore,
  MongoStore,
  
  // Factory
  factory,
  StoreFactory,
  
  // Helper functions
  createStore,
  registerStore,
  closeAllStores
};
