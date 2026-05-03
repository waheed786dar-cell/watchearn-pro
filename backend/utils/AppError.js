// ============================================
// utils/AppError.js
// PRO — Custom Error Class System
// ============================================

class AppError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode  = statusCode;
    this.status      = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors      = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Specific Error Types ──
class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 400, errors);
    this.name = 'ValidationError';
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict occurred') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};
