/**
 * Validation utilities for rate-guard
 */

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate that a value is a positive integer
 * @param {*} value - Value to validate
 * @param {string} name - Name of the field for error messages
 * @returns {number} - The validated number
 */
function validatePositiveInteger(value, name) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) {
    throw new ValidationError(`${name} must be a positive integer`, name);
  }
  return num;
}

/**
 * Validate that a value is a non-negative integer
 * @param {*} value - Value to validate
 * @param {string} name - Name of the field for error messages
 * @returns {number} - The validated number
 */
function validateNonNegativeInteger(value, name) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    throw new ValidationError(`${name} must be a non-negative integer`, name);
  }
  return num;
}

/**
 * Validate that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} name - Name of the field for error messages
 * @returns {string} - The validated string
 */
function validateNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} must be a non-empty string`, name);
  }
  return value.trim();
}

/**
 * Validate that a value is one of the allowed values
 * @param {*} value - Value to validate
 * @param {Array} allowed - Array of allowed values
 * @param {string} name - Name of the field for error messages
 * @returns {*} - The validated value
 */
function validateEnum(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new ValidationError(
      `${name} must be one of: ${allowed.join(', ')}`,
      name
    );
  }
  return value;
}

/**
 * Validate that a value is a function
 * @param {*} value - Value to validate
 * @param {string} name - Name of the field for error messages
 * @returns {Function} - The validated function
 */
function validateFunction(value, name) {
  if (typeof value !== 'function') {
    throw new ValidationError(`${name} must be a function`, name);
  }
  return value;
}

/**
 * Validate rate limit options
 * @param {Object} options - Options to validate
 * @returns {Object} - Validated options with defaults
 */
function validateRateLimitOptions(options = {}) {
  const validated = {};

  if (options.maxRequests !== undefined) {
    validated.maxRequests = validatePositiveInteger(options.maxRequests, 'maxRequests');
  }

  if (options.windowMs !== undefined) {
    validated.windowMs = validatePositiveInteger(options.windowMs, 'windowMs');
  }

  if (options.algorithm !== undefined) {
    validated.algorithm = validateEnum(
      options.algorithm,
      ['sliding-window', 'token-bucket'],
      'algorithm'
    );
  }

  if (options.keyGenerator !== undefined) {
    validated.keyGenerator = validateFunction(options.keyGenerator, 'keyGenerator');
  }

  if (options.skip !== undefined) {
    validated.skip = validateFunction(options.skip, 'skip');
  }

  return validated;
}

module.exports = {
  ValidationError,
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateNonEmptyString,
  validateEnum,
  validateFunction,
  validateRateLimitOptions
};
