const { supabaseAdmin } = require('../config/supabase');
const { catchAsync }    = require('../utils/errorHandler');
const ApiResponse       = require('../utils/response');
const {
  AppError,
  NotFoundError,
  ValidationError,
} = require('../utils/AppError');
const logger = require('../utils/logger');

const getDashboardStats = catchAsync(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsersRes, newUsersRes,
    totalCampaignsRes, pendingCampaignsRes, activeCampaignsRes,
    totalWithdrawalsRes, pendingWithdrawalsRes,
    totalEarnedRes, fraudFlagsRes, taskCompletionsRes,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('withdrawals').select('amount'),
    supabaseAdmin.from('withdrawals').select('amount').eq('status', 'pending'),
    supabaseAdmin.from('transactions').select('amount').eq('type', 'earning').eq('status', 'completed'),
    supabaseAdmin.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('resolved', false),
    supabaseAdmin.from('task_completions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
  ]);

  const sum = (rows) =>
    (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

  return ApiResponse.success(res, {
    users: {
      total:     totalUsersRes.count     || 0,
      new_today: newUsersRes.count       || 0,
    },
    campaigns: {
      total:   totalCampaignsRes.count   || 0,
      pending: pendingCampaignsRes.count || 0,
      active:  activeCampaignsRes.count  || 0,
    },
    financials: {
      total_withdrawn:    sum(totalWithdrawalsRes.data).toFixed(2),
      pending_withdrawal: sum(pendingWithdrawalsRes.data).toFixed(2),
      total_earned:       sum(totalEarnedRes.data).toFixed(2),
    },
    fraud: {
      unresolved_flags: fraudFlagsRes.count || 0,
    },
    tasks: {
      total_completions: taskCompletionsRes.count || 0,
    },
  }, 'Dashboard stats fetched.');
});

const getAllUsers = catchAsync(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const { search, role, banned } = req.query;

  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id, username, email, role,
      is_banned, ban_reason, created_at,
      wallets ( balance, total_earned )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('email', `%${search}%`);
  if (role && ['earner','advertiser','admin'].includes(role)) query = query.eq('role', role);
  if (banned === 'true')  query = query.eq('is_banned', true);
  if (banned === 'false') query = query.eq('is_banned', false);

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Users fetched.'
  );
});

const banUser = catchAsync(async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;
  const adminId    = req.user.profile.id;

  if (id === adminId) throw new AppError('Cannot ban yourself.', 400);
  if (!reason || reason.trim().length < 5) {
    throw new ValidationError(['Ban reason required (min 5 chars).']);
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_banned: true, ban_reason: reason.trim() })
    .eq('id', id)
    .select('id, username, email')
    .single();

  if (error) throw error;

  logger.security('USER_BANNED', id, { by: adminId, reason });
  return ApiResponse.success(res, data, `User ${data.email} has been banned.`);
});

const unbanUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_banned: false, ban_reason: null })
    .eq('id', id)
    .select('id, username, email')
    .single();

  if (error) throw error;

  logger.security('USER_UNBANNED', id, { by: req.user.profile.id });
  return ApiResponse.success(res, data, `User ${data.email} has been unbanned.`);
});

const getAllCampaigns = catchAsync(async (req, res) => {
  const { status } = req.query;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('campaigns')
    .select(`
      id, title, status, budget, spent,
      per_view_rate, total_views, max_views,
      required_watch_time, rejection_reason, created_at,
      profiles!campaigns_creator_id_fkey ( id, username, email )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Campaigns fetched.'
  );
});

const approveCampaign = catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns').select('*').eq('id', id).single();

  if (error || !campaign) throw new NotFoundError('Campaign');
  if (campaign.status !== 'pending') {
    throw new AppError(`Campaign is already ${campaign.status}.`, 400);
  }

  await Promise.all([
    supabaseAdmin.from('campaigns')
      .update({ status: 'active', rejection_reason: null }).eq('id', id),
    supabaseAdmin.from('tasks')
      .update({ status: 'active' }).eq('campaign_id', id),
  ]);

  logger.info('ADMIN', 'Campaign approved', { campaignId: id });
  return ApiResponse.success(res, null, 'Campaign approved and is now active.');
});

const rejectCampaign = catchAsync(async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    throw new ValidationError(['Rejection reason required (min 5 chars).']);
  }

  await Promise.all([
    supabaseAdmin.from('campaigns')
      .update({ status: 'rejected', rejection_reason: reason.trim() }).eq('id', id),
    supabaseAdmin.from('tasks')
      .update({ status: 'inactive' }).eq('campaign_id', id),
  ]);

  logger.info('ADMIN', 'Campaign rejected', { campaignId: id, reason });
  return ApiResponse.success(res, null, 'Campaign rejected.');
});

const getAllWithdrawals = catchAsync(async (req, res) => {
  const { status } = req.query;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('withdrawals')
    .select(`
      id, amount, fee, net_amount, method,
      account_number, account_name, status,
      admin_note, requested_at, processed_at,
      profiles!withdrawals_user_id_fkey ( id, username, email )
    `, { count: 'exact' })
    .order('requested_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Withdrawals fetched.'
  );
});

const processWithdrawal = catchAsync(async (req, res) => {
  const { id }           = req.params;
  const { action, note } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new ValidationError(['Action must be approve or reject.']);
  }

  const { data: withdrawal, error } = await supabaseAdmin
    .from('withdrawals').select('*').eq('id', id).single();

  if (error || !withdrawal) throw new NotFoundError('Withdrawal');
  if (withdrawal.status !== 'pending') {
    throw new AppError(`Withdrawal already ${withdrawal.status}.`, 400);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await supabaseAdmin.from('withdrawals')
    .update({
      status:       newStatus,
      admin_note:   note || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (action === 'reject') {
    await supabaseAdmin.rpc('increment_balance', {
      p_user_id: withdrawal.user_id,
      p_amount:  withdrawal.amount,
    });
  }

  logger.info('ADMIN', `Withdrawal ${newStatus}`, { withdrawalId: id });
  return ApiResponse.success(
    res, null,
    `Withdrawal ${newStatus}.${action === 'reject' ? ' Amount refunded.' : ''}`
  );
});

const getFraudFlags = catchAsync(async (req, res) => {
  const { resolved, severity } = req.query;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('fraud_flags')
    .select(`
      id, reason, severity, details, resolved, created_at,
      profiles!fraud_flags_user_id_fkey ( id, username, email, is_banned )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (resolved === 'true')  query = query.eq('resolved', true);
  if (resolved === 'false') query = query.eq('resolved', false);
  if (severity && ['low','medium','high'].includes(severity)) {
    query = query.eq('severity', severity);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Fraud flags fetched.'
  );
});

const resolveFlag = catchAsync(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('fraud_flags')
    .update({ resolved: true })
    .eq('id', id);

  if (error) throw error;

  logger.info('ADMIN', 'Fraud flag resolved', { flagId: id });
  return ApiResponse.success(res, null, 'Fraud flag marked as resolved.');
});

module.exports = {
  getDashboardStats, getAllUsers, banUser, unbanUser,
  getAllCampaigns, approveCampaign, rejectCampaign,
  getAllWithdrawals, processWithdrawal,
  getFraudFlags, resolveFlag,
};
