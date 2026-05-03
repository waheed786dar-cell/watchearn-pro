// ============================================
// FILE 017 — controllers/campaign.controller.js
// PRO LEVEL — Full Campaign Management System
// ============================================

const { supabaseAdmin } = require('../config/supabase');

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const MIN_BUDGET        = 500;    // PKR
const MIN_PER_VIEW      = 0.01;   // PKR
const MAX_PER_VIEW      = 10;     // PKR
const MIN_WATCH_TIME    = 10;     // seconds
const MAX_WATCH_TIME    = 300;    // seconds
const MIN_MAX_VIEWS     = 100;
const MAX_MAX_VIEWS     = 100000;

// ─────────────────────────────────────────
// VALIDATOR
// ─────────────────────────────────────────
const validateCampaign = (body) => {
  const errors = [];
  const {
    title, video_url, budget,
    per_view_rate, required_watch_time,
    max_views,
  } = body;

  if (!title || title.trim().length < 3)
    errors.push('Title must be at least 3 characters.');

  if (title && title.trim().length > 100)
    errors.push('Title must be under 100 characters.');

  if (!video_url || !video_url.includes('youtube.com') && !video_url.includes('youtu.be'))
    errors.push('Valid YouTube video URL is required.');

  if (!budget || isNaN(budget) || Number(budget) < MIN_BUDGET)
    errors.push(`Minimum budget is PKR ${MIN_BUDGET}.`);

  if (!per_view_rate || isNaN(per_view_rate))
    errors.push('Per view rate is required.');

  if (Number(per_view_rate) < MIN_PER_VIEW || Number(per_view_rate) > MAX_PER_VIEW)
    errors.push(`Per view rate must be between PKR ${MIN_PER_VIEW} and ${MAX_PER_VIEW}.`);

  if (!required_watch_time || isNaN(required_watch_time))
    errors.push('Required watch time is required.');

  if (Number(required_watch_time) < MIN_WATCH_TIME || Number(required_watch_time) > MAX_WATCH_TIME)
    errors.push(`Watch time must be between ${MIN_WATCH_TIME}s and ${MAX_WATCH_TIME}s.`);

  if (!max_views || isNaN(max_views))
    errors.push('Max views is required.');

  if (Number(max_views) < MIN_MAX_VIEWS || Number(max_views) > MAX_MAX_VIEWS)
    errors.push(`Max views must be between ${MIN_MAX_VIEWS} and ${MAX_MAX_VIEWS}.`);

  // Budget must cover all views
  const totalCost = Number(per_view_rate) * Number(max_views);
  if (Number(budget) < totalCost) {
    errors.push(
      `Budget PKR ${budget} is insufficient. Need PKR ${totalCost.toFixed(2)} for ${max_views} views at PKR ${per_view_rate}/view.`
    );
  }

  return errors;
};

// ─────────────────────────────────────────
// Extract YouTube Video ID
// ─────────────────────────────────────────
const extractYouTubeId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// ─────────────────────────────────────────
// POST /api/campaigns — Create Campaign
// ─────────────────────────────────────────
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const {
      title, video_url, thumbnail_url,
      description, budget, per_view_rate,
      required_watch_time, max_views,
    } = req.body;

    // Validate
    const errors = validateCampaign(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Extract YouTube ID for embed
    const videoId = extractYouTubeId(video_url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract YouTube video ID from URL.',
      });
    }

    const embedUrl     = `https://www.youtube.com/embed/${videoId}`;
    const autoThumb    = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Create campaign
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        creator_id:          userId,
        title:               title.trim(),
        video_url:           embedUrl,
        thumbnail_url:       thumbnail_url || autoThumb,
        description:         description?.trim() || null,
        budget:              Number(budget),
        spent:               0,
        per_view_rate:       Number(per_view_rate),
        required_watch_time: Number(required_watch_time),
        max_views:           Number(max_views),
        total_views:         0,
        status:              'pending', // Admin must approve
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-create task for this campaign
    const { error: taskErr } = await supabaseAdmin
      .from('tasks')
      .insert({
        campaign_id:         campaign.id,
        title:               `Watch: ${title.trim()}`,
        description:         description?.trim() || `Watch this video for ${required_watch_time} seconds and earn PKR ${per_view_rate}`,
        reward:              Number(per_view_rate),
        required_watch_time: Number(required_watch_time),
        max_completions:     Number(max_views),
        total_completions:   0,
        status:              'inactive', // Active when campaign approved
      });

    if (taskErr) throw taskErr;

    return res.status(201).json({
      success: true,
      message: 'Campaign submitted for review. It will be active after admin approval.',
      data:    campaign,
    });

  } catch (err) {
    console.error('createCampaign error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create campaign.',
    });
  }
};

// ─────────────────────────────────────────
// GET /api/campaigns — My Campaigns
// ─────────────────────────────────────────
const getMyCampaigns = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const status = req.query.status;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(20, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ['pending','active','paused','rejected','completed'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with budget remaining
    const enriched = (data || []).map(c => ({
      ...c,
      budget_remaining:  Number(c.budget) - Number(c.spent),
      views_remaining:   c.max_views - c.total_views,
      completion_rate:   c.max_views > 0
        ? ((c.total_views / c.max_views) * 100).toFixed(1)
        : '0.0',
    }));

    return res.status(200).json({
      success:     true,
      total:       count,
      page,
      total_pages: Math.ceil(count / limit),
      data:        enriched,
    });

  } catch (err) {
    console.error('getMyCampaigns error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns.',
    });
  }
};

// ─────────────────────────────────────────
// GET /api/campaigns/:id — Single Campaign
// ─────────────────────────────────────────
const getCampaignById = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const { id } = req.params;
    const role   = req.user.profile.role;

    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      });
    }

    // Non-admin can only see own campaigns
    if (role !== 'admin' && campaign.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...campaign,
        budget_remaining: Number(campaign.budget) - Number(campaign.spent),
        views_remaining:  campaign.max_views - campaign.total_views,
      },
    });

  } catch (err) {
    console.error('getCampaignById error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign.',
    });
  }
};

// ─────────────────────────────────────────
// GET /api/campaigns/:id/stats
// ─────────────────────────────────────────
const getCampaignStats = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const { id } = req.params;
    const role   = req.user.profile.role;

    // Verify ownership
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('campaigns')
      .select('id, creator_id, title, budget, spent, total_views, max_views')
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found.' });
    }

    if (role !== 'admin' && campaign.creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // Get completions breakdown
    const [approvedRes, pendingRes, rejectedRes] = await Promise.all([
      supabaseAdmin
        .from('task_completions')
        .select('id, reward_amount', { count: 'exact' })
        .eq('campaign_id', id)
        .eq('status', 'approved'),

      supabaseAdmin
        .from('task_completions')
        .select('id', { count: 'exact' })
        .eq('campaign_id', id)
        .eq('status', 'pending'),

      supabaseAdmin
        .from('task_completions')
        .select('id', { count: 'exact' })
        .eq('campaign_id', id)
        .eq('status', 'rejected'),
    ]);

    const totalPaid = (approvedRes.data || [])
      .reduce((sum, c) => sum + Number(c.reward_amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        campaign_id:      id,
        title:            campaign.title,
        budget:           Number(campaign.budget),
        spent:            Number(campaign.spent),
        remaining_budget: Number(campaign.budget) - Number(campaign.spent),
        total_views:      campaign.total_views,
        max_views:        campaign.max_views,
        views_remaining:  campaign.max_views - campaign.total_views,
        completion_rate:  campaign.max_views > 0
          ? ((campaign.total_views / campaign.max_views) * 100).toFixed(1)
          : '0.0',
        completions: {
          approved: approvedRes.count || 0,
          pending:  pendingRes.count  || 0,
          rejected: rejectedRes.count || 0,
        },
        total_paid: totalPaid.toFixed(2),
      },
    });

  } catch (err) {
    console.error('getCampaignStats error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign stats.',
    });
  }
};

// ─────────────────────────────────────────
// PATCH /api/campaigns/:id — Update Campaign
// ─────────────────────────────────────────
const updateCampaign = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const { id } = req.params;
    const role   = req.user.profile.role;

    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found.' });
    }

    if (role !== 'admin' && campaign.creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // Can only edit pending campaigns
    if (campaign.status !== 'pending' && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Only pending campaigns can be edited.',
      });
    }

    const allowedFields = ['title', 'description', 'thumbnail_url'];
    const updates = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update.' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: 'Campaign updated.',
      data:    updated,
    });

  } catch (err) {
    console.error('updateCampaign error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update campaign.' });
  }
};

// ─────────────────────────────────────────
// DELETE /api/campaigns/:id
// ─────────────────────────────────────────
const deleteCampaign = async (req, res) => {
  try {
    const userId = req.user.profile.id;
    const { id } = req.params;
    const role   = req.user.profile.role;

    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found.' });
    }

    if (role !== 'admin' && campaign.creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    if (campaign.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete an active campaign. Pause it first.',
      });
    }

    await supabaseAdmin.from('campaigns').delete().eq('id', id);

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully.',
    });

  } catch (err) {
    console.error('deleteCampaign error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete campaign.' });
  }
};

module.exports = {
  createCampaign,
  getMyCampaigns,
  getCampaignById,
  getCampaignStats,
  updateCampaign,
  deleteCampaign,
};
