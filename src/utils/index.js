/**
 * Utility exports for rate-guard
 */

const validation = require('./validation');
const errors = require('./errors');

module.exports = {
  // Validation exports
  ValidationError: validation.ValidationError,
  validatePositiveInteger: validation.validatePositiveInteger,
  validateNonNegativeInteger: validation.validateNonNegativeInteger,
  validateNonEmptyString: validation.validateNonEmptyString,
  validateEnum: validation.validateEnum,
  validateFunction: validation.validateFunction,
  validateRateLimitOptions: validation.validateRateLimitOptions,

  // Error exports
  RateGuardError: errors.RateGuardError,
  RateLimitExceededError: errors.RateLimitExceededError,
  StoreError: errors.StoreError,
  ConfigurationError: errors.ConfigurationError,
  formatErrorResponse: errors.formatErrorResponse,
  asyncErrorHandler: errors.asyncErrorHandler
};
