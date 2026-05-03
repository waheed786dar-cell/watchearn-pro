const { supabaseAdmin }        = require('../config/supabase');
const { creditReward }         = require('../services/reward.service');
const { flagFraud, logAction } = require('../middleware/fraud');
const { catchAsync }           = require('../utils/errorHandler');
const ApiResponse              = require('../utils/response');
const {
  NotFoundError,
  AppError,
  ConflictError,
} = require('../utils/AppError');
const logger = require('../utils/logger');

const getAllTasks = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;

  const { data: tasks, error } = await supabaseAdmin
    .from('tasks')
    .select(`
      id, title, description, reward,
      required_watch_time, total_completions,
      max_completions, status, created_at,
      campaigns (
        id, title, video_url,
        thumbnail_url, per_view_rate
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: completed } = await supabaseAdmin
    .from('task_completions')
    .select('task_id')
    .eq('user_id', userId)
    .eq('status', 'approved');

  const completedIds = new Set((completed || []).map(c => c.task_id));

  const enriched = (tasks || [])
    .filter(t => t.total_completions < t.max_completions)
    .map(task => ({
      ...task,
      already_completed: completedIds.has(task.id),
    }));

  return ApiResponse.success(res, enriched, 'Tasks fetched successfully.');
});

const getTaskById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .select(`
      id, title, description, reward,
      required_watch_time, total_completions,
      max_completions, status, created_at,
      campaigns (
        id, title, video_url, thumbnail_url,
        description, per_view_rate, status
      )
    `)
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (error || !task) throw new NotFoundError('Task');
  if (task.campaigns?.status !== 'active') throw new NotFoundError('Task');

  return ApiResponse.success(res, task, 'Task fetched successfully.');
});

const completeTask = catchAsync(async (req, res) => {
  const userId     = req.user.profile.id;
  const taskId     = req.params.id;
  const { watch_time } = req.body;
  const ip         = req.clientIP;
  const deviceHash = req.deviceHash;

  const { data: task, error: taskErr } = await supabaseAdmin
    .from('tasks')
    .select('*, campaigns(*)')
    .eq('id', taskId)
    .eq('status', 'active')
    .single();

  if (taskErr || !task) throw new NotFoundError('Task');

  if (!watch_time || Number(watch_time) < task.required_watch_time) {
    await flagFraud(userId, 'Insufficient watch time', 'medium', {
      task_id:   taskId,
      required:  task.required_watch_time,
      submitted: watch_time,
    });
    throw new AppError(
      `You must watch for at least ${task.required_watch_time} seconds.`, 400
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('task_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .single();

  if (existing) throw new ConflictError('You have already completed this task.');

  const campaign = task.campaigns;

  if (Number(campaign.spent) >= Number(campaign.budget)) {
    throw new AppError('Campaign budget exhausted.', 400);
  }

  if (task.total_completions >= task.max_completions) {
    throw new AppError('Task has reached maximum completions.', 400);
  }

  const rewardAmount = Number(task.reward);

  const { data: completion, error: compErr } = await supabaseAdmin
    .from('task_completions')
    .insert({
      user_id:       userId,
      task_id:       taskId,
      campaign_id:   campaign.id,
      watch_time:    Number(watch_time),
      ip_address:    ip,
      device_hash:   deviceHash,
      status:        'approved',
      reward_amount: rewardAmount,
    })
    .select()
    .single();

  if (compErr) throw compErr;

  const reward = await creditReward(
    userId, rewardAmount,
    completion.id, `Task: ${task.title}`
  );

  if (!reward.success) throw new AppError(reward.error, 500);

  await Promise.all([
    supabaseAdmin
      .from('tasks')
      .update({ total_completions: task.total_completions + 1 })
      .eq('id', taskId),

    supabaseAdmin
      .from('campaigns')
      .update({
        spent:       Number(campaign.spent) + rewardAmount,
        total_views: (campaign.total_views || 0) + 1,
      })
      .eq('id', campaign.id),
  ]);

  await logAction(userId, ip, deviceHash, 'task_completed');

  logger.info('TASK', 'Task completed', { userId, taskId, reward: rewardAmount });

  return ApiResponse.success(res, {
    reward_amount: rewardAmount,
    completion_id: completion.id,
  }, `Task completed! You earned PKR ${rewardAmount}`);
});

const getUserCompletions = catchAsync(async (req, res) => {
  const userId = req.user.profile.id;
  const page   = Math.max(1, parseInt(req.query.page)   || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('task_completions')
    .select(`
      id, watch_time, status,
      reward_amount, completed_at,
      tasks ( id, title, reward )
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return ApiResponse.paginated(
    res, data || [],
    { total: count, page, limit },
    'Completions fetched.'
  );
});

module.exports = {
  getAllTasks,
  getTaskById,
  completeTask,
  getUserCompletions,
};
