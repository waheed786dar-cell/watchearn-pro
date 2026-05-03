// ============================================
// controllers/wallet.controller.js — PRO
// ============================================

const { supabaseAdmin }  = require('../config/supabase');
const { catchAsync }     = require('../utils/errorHandler');
const ApiResponse        = require('../utils/response');
const { NotFoundError }  = require('../utils/AppError');
const logger             = require('../utils/logger');

// ── Auto-create wallet ──
const ensureWallet = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: userId, balance: 0, pending: 0, total_earned: 0 })
      .select()
      .single();
    if (createErr) throw createErr;
    return created;
  }
  return data;
};

// ─────────────────────────────────────────
// GET /api/wallet
// ─────────────────────────────────────────
const getWallet = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const wallet = await ensureWallet(userId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingWithdrawals, todayTx] = await Promise.all([
    supabaseAdmin
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending'),

    supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'earning')
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString()),
  ]);

  const totalPendingWithdraw = (pendingWithdrawals.data || [])
    .reduce((sum, w) => sum + Number(w.amount), 0);

  const todayEarnings = (todayTx.data || [])
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return ApiResponse.success(res, {
    balance:                Number(wallet.balance).toFixed(2),
    pending:                Number(wallet.pending).toFixed(2),
    total_earned:           Number(wallet.total_earned).toFixed(2),
    pending_withdrawals:    totalPendingWithdraw.toFixed(2),
    today_earnings:         todayEarnings.toFixed(2),
    available_for_withdraw: Math.max(
      0, Number(wallet.balance) - totalPendingWithdraw
    ).toFixed(2),
    updated_at: wallet.updated_at,
  }, 'Wallet fetched successfully.');
});

// ─────────────────────────────────────────
// GET /api/wallet/transactions
// ─────────────────────────────────────────
const getTransactions = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const type   = req.query.type;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && ['earning', 'withdrawal'].includes(type)) {
    query = query.eq('type', type);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res,
    data || [],
    { total: count, page, limit },
    'Transactions fetched.'
  );
});

// ─────────────────────────────────────────
// GET /api/wallet/stats
// ─────────────────────────────────────────
const getEarningStats = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const now    = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    todayRes, weekRes, monthRes,
    totalRes, approvedRes, pendingRes,
  ] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount')
      .eq('user_id', userId).eq('type', 'earning')
      .gte('created_at', todayStart.toISOString()),

    supabaseAdmin.from('transactions').select('amount')
      .eq('user_id', userId).eq('type', 'earning')
      .gte('created_at', weekStart.toISOString()),

    supabaseAdmin.from('transactions').select('amount')
      .eq('user_id', userId).eq('type', 'earning')
      .gte('created_at', monthStart.toISOString()),

    supabaseAdmin.from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    supabaseAdmin.from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'approved'),

    supabaseAdmin.from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'pending'),
  ]);

  const sum = (rows) =>
    (rows || []).reduce((acc, r) => acc + Number(r.amount), 0);

  return ApiResponse.success(res, {
    earnings: {
      today: sum(todayRes.data).toFixed(2),
      week:  sum(weekRes.data).toFixed(2),
      month: sum(monthRes.data).toFixed(2),
    },
    tasks: {
      total:    totalRes.count    || 0,
      approved: approvedRes.count || 0,
      pending:  pendingRes.count  || 0,
      rejected: Math.max(0,
        (totalRes.count || 0) -
        (approvedRes.count || 0) -
        (pendingRes.count || 0)
      ),
    },
    success_rate: totalRes.count > 0
      ? ((approvedRes.count / totalRes.count) * 100).toFixed(1)
      : '0.0',
  }, 'Stats fetched successfully.');
});

module.exports = { getWallet, getTransactions, getEarningStats };
