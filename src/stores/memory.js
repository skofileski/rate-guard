/**
 * In-memory storage adapter for rate limiting
 * Suitable for single-instance deployments or development
 */
class MemoryStore {
	constructor() {
		this.cache = new Map();
		this.timers = new Map();
	}

	/**
	 * Get a value from the store
	 * @param {string} key - The key to retrieve
	 * @returns {Promise<any>} The stored value or null
	 */
	async get(key) {
		const entry = this.cache.get(key);
		if (!entry) return null;
		
		if (entry.expiresAt && entry.expiresAt < Date.now()) {
			this.cache.delete(key);
			return null;
		}
		
		return entry.value;
	}

	/**
	 * Set a value in the store
	 * @param {string} key - The key to store
	 * @param {any} value - The value to store
	 * @param {number} ttlMs - Time to live in milliseconds
	 * @returns {Promise<void>}
	 */
	async set(key, value, ttlMs) {
		// Clear existing timer if any
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
		}

		const expiresAt = ttlMs ? Date.now() + ttlMs : null;
		this.cache.set(key, { value, expiresAt });

		// Set cleanup timer
		if (ttlMs) {
			const timer = setTimeout(() => {
				this.cache.delete(key);
				this.timers.delete(key);
			}, ttlMs);
			timer.unref(); // Don't keep process alive
			this.timers.set(key, timer);
		}
	}

	/**
	 * Delete a key from the store
	 * @param {string} key - The key to delete
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}
		this.cache.delete(key);
	}

	/**
	 * Clear all entries from the store
	 * @returns {Promise<void>}
	 */
	async clear() {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
		this.cache.clear();
	}
}

module.exports = MemoryStore;