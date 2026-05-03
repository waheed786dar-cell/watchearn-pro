const { supabaseAdmin }       = require('../config/supabase');
const { deductBalance }       = require('../services/reward.service');
const { catchAsync }          = require('../utils/errorHandler');
const ApiResponse             = require('../utils/response');
const { validateWithdrawal }  = require('../utils/validator');
const {
  AppError,
  ValidationError,
  NotFoundError,
} = require('../utils/AppError');
const logger = require('../utils/logger');

const MIN_WITHDRAW   = 100;
const WITHDRAWAL_FEE = 0.05;

const requestWithdrawal = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;

  const v = validateWithdrawal(req.body);
  if (!v.isValid()) throw new ValidationError(v.getErrors());

  const { amount, method, account_number, account_name } = req.body;

  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (walletErr || !wallet) throw new NotFoundError('Wallet');

  if (Number(wallet.balance) < Number(amount)) {
    throw new AppError(
      `Insufficient balance. Available: PKR ${Number(wallet.balance).toFixed(2)}`, 400
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('withdrawals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (existing && existing.length >= 2) {
    throw new AppError('You already have 2 pending withdrawals. Wait for them to process.', 400);
  }

  const fee       = Number((Number(amount) * WITHDRAWAL_FEE).toFixed(2));
  const netAmount = Number((Number(amount) - fee).toFixed(2));

  const { data: withdrawal, error: wErr } = await supabaseAdmin
    .from('withdrawals')
    .insert({
      user_id:        userId,
      amount:         Number(amount),
      fee,
      net_amount:     netAmount,
      method,
      account_number: account_number.trim(),
      account_name:   account_name.trim(),
      status:         'pending',
    })
    .select()
    .single();

  if (wErr) throw wErr;

  const deduct = await deductBalance(
    userId, Number(amount), fee,
    withdrawal.id, `Withdrawal via ${method}`
  );

  if (!deduct.success) {
    await supabaseAdmin.from('withdrawals').delete().eq('id', withdrawal.id);
    throw new AppError(deduct.error || 'Failed to process withdrawal.', 500);
  }

  logger.info('WITHDRAW', 'Withdrawal requested', { userId, amount, method });

  return ApiResponse.created(res, {
    id:           withdrawal.id,
    amount:       Number(amount),
    fee,
    net_amount:   netAmount,
    method,
    status:       'pending',
    requested_at: withdrawal.requested_at,
  }, 'Withdrawal request submitted successfully.');
});

const getWithdrawals = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const status = req.query.status;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(20, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('withdrawals')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && ['pending','approved','rejected'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Withdrawals fetched.'
  );
});

const cancelWithdrawal = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const { id } = req.params;

  const { data: withdrawal, error } = await supabaseAdmin
    .from('withdrawals')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !withdrawal) throw new NotFoundError('Withdrawal');

  if (withdrawal.status !== 'pending') {
    throw new AppError(`Cannot cancel a ${withdrawal.status} withdrawal.`, 400);
  }

  await Promise.all([
    supabaseAdmin
      .from('withdrawals')
      .update({ status: 'cancelled' })
      .eq('id', id),

    supabaseAdmin.rpc('increment_balance', {
      p_user_id: userId,
      p_amount:  withdrawal.amount,
    }),
  ]);

  logger.info('WITHDRAW', 'Withdrawal cancelled', { userId, withdrawalId: id });

  return ApiResponse.success(
    res, null,
    `Withdrawal cancelled. PKR ${withdrawal.amount} refunded to wallet.`
  );
});

module.exports = { requestWithdrawal, getWithdrawals, cancelWithdrawal };
