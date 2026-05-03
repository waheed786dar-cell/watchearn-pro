// ============================================
// controllers/auth.controller.js — PRO
// ============================================

const { supabaseAdmin }    = require('../config/supabase');
const { catchAsync }       = require('../utils/errorHandler');
const ApiResponse          = require('../utils/response');
const { validateProfile }  = require('../utils/validator');
const {
  NotFoundError,
  ValidationError,
  ConflictError,
  AppError,
} = require('../utils/AppError');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────
const getProfile = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;

  const [profileRes, walletRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username, email, role, avatar_url, created_at')
      .eq('id', userId)
      .single(),

    supabaseAdmin
      .from('wallets')
      .select('balance, pending, total_earned')
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileRes.error) throw profileRes.error;

  return ApiResponse.success(res, {
    profile: profileRes.data,
    wallet:  walletRes.data || { balance: 0, pending: 0, total_earned: 0 },
  }, 'Profile fetched successfully.');
});

// ─────────────────────────────────────────
// PATCH /api/auth/profile
// ─────────────────────────────────────────
const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;

  // Validate
  const v = validateProfile(req.body);
  if (!v.isValid()) throw new ValidationError(v.getErrors());

  const allowedFields = ['username', 'avatar_url'];
  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    throw new ValidationError(['No valid fields to update.']);
  }

  // Username uniqueness check
  if (updates.username) {
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', updates.username)
      .neq('id', userId)
      .single();

    if (existing) throw new ConflictError('Username already taken.');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, username, email, avatar_url')
    .single();

  if (error) throw error;

  logger.info('AUTH', 'Profile updated', { userId });
  return ApiResponse.success(res, data, 'Profile updated successfully.');
});

// ─────────────────────────────────────────
// DELETE /api/auth/account
// ─────────────────────────────────────────
const deleteAccount = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;

  const { data: pending } = await supabaseAdmin
    .from('withdrawals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (pending && pending.length > 0) {
    throw new AppError(
      'Cannot delete account with pending withdrawals.', 400
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;

  logger.security('ACCOUNT_DELETED', userId);
  return ApiResponse.success(res, null, 'Account deleted successfully.');
});

module.exports = { getProfile, updateProfile, deleteAccount };
