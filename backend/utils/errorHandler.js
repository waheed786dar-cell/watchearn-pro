const logger = require('./logger');

const handleSupabaseError = (err) => {
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'field';
    return { message: `${field} already exists.`, statusCode: 409 };
  }
  if (err.code === '23503') {
    return { message: 'Referenced record not found.', statusCode: 400 };
  }
  if (err.code === '23502') {
    const field = err.column || 'field';
    return { message: `${field} is required.`, statusCode: 400 };
  }
  if (err.code === 'PGRST116') {
    return { message: 'Record not found.', statusCode: 404 };
  }
  return null;
};

const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Something went wrong.';
  let errors     = err.errors     || [];

  const supabaseErr = handleSupabaseError(err);
  if (supabaseErr) {
    statusCode = supabaseErr.statusCode;
    message    = supabaseErr.message;
  }

  if (statusCode >= 500) {
    logger.error('SERVER', message, { url: req.originalUrl, stack: err.stack });
  } else {
    logger.warn('CLIENT', message, { url: req.originalUrl });
  }

  const payload = {
    success:   false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors.length > 0) payload.errors = errors;

  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};

const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = { globalErrorHandler, catchAsync };
