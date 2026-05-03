// ============================================
// FILE 006 — middleware/fraud.js
// IP + Device fraud detection middleware
// ============================================

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

// ─────────────────────────────────────────
// Generate device fingerprint hash
// ─────────────────────────────────────────
const generateDeviceHash = (req) => {
  const raw = [
    req.headers['user-agent']    || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ].join('|');

  return crypto.createHash('sha256').update(raw).digest('hex');
};

// ─────────────────────────────────────────
// Get real IP (works behind proxy too)
// ─────────────────────────────────────────
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    '0.0.0.0'
  );
};

// ─────────────────────────────────────────
// LOG every action to ip_logs table
// ─────────────────────────────────────────
const logAction = async (userId, ip, deviceHash, action) => {
  try {
    await supabaseAdmin.from('ip_logs').insert({
      user_id:     userId,
      ip_address:  ip,
      device_hash: deviceHash,
      action:      action,
    });
  } catch (err) {
    console.error('Log action error:', err.message);
  }
};

// ─────────────────────────────────────────
// FLAG user as fraud
// ─────────────────────────────────────────
const flagFraud = async (userId, reason, severity, details) => {
  try {
    await supabaseAdmin.from('fraud_flags').insert({
      user_id:  userId,
      reason:   reason,
      severity: severity,
      details:  details,
      resolved: false,
    });
    console.warn(`🚨 Fraud flagged: ${userId} — ${reason}`);
  } catch (err) {
    console.error('Flag fraud error:', err.message);
  }
};

// ─────────────────────────────────────────
// MAIN FRAUD CHECK MIDDLEWARE
// Use on task completion routes only
// ─────────────────────────────────────────
const fraudCheck = async (req, res, next) => {
  try {
    const userId     = req.user.profile.id;
    const ip         = getClientIP(req);
    const deviceHash = generateDeviceHash(req);

    // Attach to request for controllers to use
    req.clientIP     = ip;
    req.deviceHash   = deviceHash;

    // ── CHECK 1: Same IP used by 3+ different accounts ──
    const { data: ipUsers } = await supabaseAdmin
      .from('ip_logs')
      .select('user_id')
      .eq('ip_address', ip)
      .neq('user_id', userId);

    const uniqueIPUsers = [...new Set((ipUsers || []).map(r => r.user_id))];

    if (uniqueIPUsers.length >= 3) {
      await flagFraud(userId, 'Multiple accounts on same IP', 'high', {
        ip,
        other_users: uniqueIPUsers,
      });
      return res.status(403).json({
        success: false,
        error: 'Suspicious activity detected. Account flagged for review.',
      });
    }

    // ── CHECK 2: Same device used by 2+ accounts ──
    const { data: deviceUsers } = await supabaseAdmin
      .from('ip_logs')
      .select('user_id')
      .eq('device_hash', deviceHash)
      .neq('user_id', userId);

    const uniqueDeviceUsers = [...new Set((deviceUsers || []).map(r => r.user_id))];

    if (uniqueDeviceUsers.length >= 2) {
      await flagFraud(userId, 'Multiple accounts on same device', 'high', {
        device_hash:  deviceHash,
        other_users:  uniqueDeviceUsers,
      });
      return res.status(403).json({
        success: false,
        error: 'Device already linked to another account.',
      });
    }

    // ── CHECK 3: Too many completions today ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('completed_at', todayStart.toISOString());

    if (count >= 50) {
      await flagFraud(userId, 'Exceeded daily task limit', 'medium', {
        completions_today: count,
      });
      return res.status(429).json({
        success: false,
        error: 'Daily task limit reached. Come back tomorrow!',
      });
    }

    // ── All checks passed — log this action ──
    await logAction(userId, ip, deviceHash, req.body.action || 'task_attempt');

    next();

  } catch (err) {
    console.error('Fraud check error:', err.message);
    // Don't block user if fraud check itself fails
    next();
  }
};

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
module.exports = {
  fraudCheck,
  generateDeviceHash,
  getClientIP,
  logAction,
  flagFraud,
};
