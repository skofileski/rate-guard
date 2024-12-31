/**
 * Redis storage adapter for rate limiting
 * Suitable for distributed deployments with multiple instances
 */
class RedisStore {
	/**
	 * Create a Redis store
	 * @param {Object} client - Redis client instance
	 * @param {string} prefix - Key prefix for namespacing (default: 'rg:')
	 */
	constructor(client, prefix = 'rg:') {
		if (!client) {
			throw new Error('Redis client is required');
		}
		this.client = client;
		this.prefix = prefix;
	}

	/**
	 * Get the full key with prefix
	 * @param {string} key - The base key
	 * @returns {string} Prefixed key
	 */
	_key(key) {
		return `${this.prefix}${key}`;
	}

	/**
	 * Get a value from Redis
	 * @param {string} key - The key to retrieve
	 * @returns {Promise<any>} The stored value or null
	 */
	async get(key) {
		const data = await this.client.get(this._key(key));
		if (!data) return null;
		
		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	/**
	 * Set a value in Redis
	 * @param {string} key - The key to store
	 * @param {any} value - The value to store
	 * @param {number} ttlMs - Time to live in milliseconds
	 * @returns {Promise<void>}
	 */
	async set(key, value, ttlMs) {
		const serialized = JSON.stringify(value);
		const fullKey = this._key(key);

		if (ttlMs) {
			await this.client.set(fullKey, serialized, { PX: ttlMs });
		} else {
			await this.client.set(fullKey, serialized);
		}
	}

	/**
	 * Delete a key from Redis
	 * @param {string} key - The key to delete
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		await this.client.del(this._key(key));
	}
}

module.exports = RedisStore;