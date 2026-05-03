// ============================================
// utils/response.js
// PRO — Unified API Response System
// ============================================

class ApiResponse {

  // ── Success Responses ──
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const payload = {
      success:   true,
      message,
      timestamp: new Date().toISOString(),
    };
    if (data !== null) payload.data = data;
    return res.status(statusCode).json(payload);
  }

  static created(res, data, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success:    true,
      message,
      timestamp:  new Date().toISOString(),
      pagination: {
        total:       pagination.total,
        page:        pagination.page,
        limit:       pagination.limit,
        total_pages: Math.ceil(pagination.total / pagination.limit),
        has_next:    pagination.page < Math.ceil(pagination.total / pagination.limit),
        has_prev:    pagination.page > 1,
      },
      data,
    });
  }

  // ── Error Responses ──
  static error(res, message = 'Something went wrong', statusCode = 500, errors = []) {
    const payload = {
      success:   false,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errors.length > 0) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }

  static validationError(res, errors = []) {
    return ApiResponse.error(res, 'Validation failed', 400, errors);
  }

  static unauthorized(res, message = 'Access denied. No token provided.') {
    return ApiResponse.error(res, message, 401);
  }

  static forbidden(res, message = 'You do not have permission.') {
    return ApiResponse.error(res, message, 403);
  }

  static notFound(res, resource = 'Resource') {
    return ApiResponse.error(res, `${resource} not found.`, 404);
  }

  static conflict(res, message = 'Conflict occurred.') {
    return ApiResponse.error(res, message, 409);
  }
}

module.exports = ApiResponse;
