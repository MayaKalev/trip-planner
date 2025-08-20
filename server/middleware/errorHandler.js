// Global error middleware
const errorHandler = (err, req, res, next) => {
  // Copy error object
  let error = { ...err };
  error.message = err.message;

  // Mongoose – invalid ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose – duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value';
    error = { message, statusCode: 400 };
  }

  // Mongoose – validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT – invalid token
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  // JWT – expired token
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Default response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    // Show stack only in dev
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Wrapper for async functions (no need for try/catch)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Format validation errors
const formatValidationErrors = (errors) => {
  const formattedErrors = {};
  Object.keys(errors).forEach(key => {
    formattedErrors[key] = errors[key].message;
  });
  return formattedErrors;
};

module.exports = {
  errorHandler,
  asyncHandler,
  formatValidationErrors
};
