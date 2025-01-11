/**
 * Custom error classes for rate-guard
 */

class RateGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateGuardError';
  }
}

class RateLimitExceededError extends RateGuardError {
  constructor(message, details = {}) {
    super(message || 'Rate limit exceeded');
    this.name = 'RateLimitExceededError';
    this.statusCode = 429;
    this.retryAfter = details.retryAfter || null;
    this.limit = details.limit || null;
    this.remaining = details.remaining || 0;
    this.resetTime = details.resetTime || null;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
      limit: this.limit,
      remaining: this.remaining,
      resetTime: this.resetTime
    };
  }
}

class StoreError extends RateGuardError {
  constructor(message, store) {
    super(message);
    this.name = 'StoreError';
    this.store = store;
  }
}

class ConfigurationError extends RateGuardError {
  constructor(message, config) {
    super(message);
    this.name = 'ConfigurationError';
    this.config = config;
  }
}

/**
 * Create a standardized error response object
 * @param {Error} error - The error to format
 * @returns {Object} - Formatted error response
 */
function formatErrorResponse(error) {
  if (error instanceof RateLimitExceededError) {
    return error.toJSON();
  }

  return {
    error: error.name || 'Error',
    message: error.message,
    statusCode: error.statusCode || 500
  };
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
function asyncErrorHandler(fn) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      if (error instanceof RateGuardError) {
        throw error;
      }
      throw new RateGuardError(`Unexpected error: ${error.message}`);
    }
  };
}

module.exports = {
  RateGuardError,
  RateLimitExceededError,
  StoreError,
  ConfigurationError,
  formatErrorResponse,
  asyncErrorHandler
};
