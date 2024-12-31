/**
 * MongoDB storage adapter for rate limiting
 * Suitable for applications already using MongoDB
 */
class MongoStore {
	/**
	 * Create a MongoDB store
	 * @param {Object} collection - MongoDB collection instance
	 */
	constructor(collection) {
		if (!collection) {
			throw new Error('MongoDB collection is required');
		}
		this.collection = collection;
		this._ensureIndex();
	}

	/**
	 * Ensure TTL index exists for automatic cleanup
	 */
	async _ensureIndex() {
		try {
			await this.collection.createIndex(
				{ expiresAt: 1 },
				{ expireAfterSeconds: 0 }
			);
		} catch (error) {
			// Index might already exist
			console.warn('MongoStore: Could not create TTL index:', error.message);
		}
	}

	/**
	 * Get a value from MongoDB
	 * @param {string} key - The key to retrieve
	 * @returns {Promise<any>} The stored value or null
	 */
	async get(key) {
		const doc = await this.collection.findOne({ _id: key });
		
		if (!doc) return null;
		
		// Check if expired (backup check, TTL index handles cleanup)
		if (doc.expiresAt && doc.expiresAt < new Date()) {
			return null;
		}
		
		return doc.value;
	}

	/**
	 * Set a value in MongoDB
	 * @param {string} key - The key to store
	 * @param {any} value - The value to store
	 * @param {number} ttlMs - Time to live in milliseconds
	 * @returns {Promise<void>}
	 */
	async set(key, value, ttlMs) {
		const doc = {
			_id: key,
			value,
			updatedAt: new Date()
		};

		if (ttlMs) {
			doc.expiresAt = new Date(Date.now() + ttlMs);
		}

		await this.collection.updateOne(
			{ _id: key },
			{ $set: doc },
			{ upsert: true }
		);
	}

	/**
	 * Delete a key from MongoDB
	 * @param {string} key - The key to delete
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		await this.collection.deleteOne({ _id: key });
	}
}

module.exports = MongoStore;