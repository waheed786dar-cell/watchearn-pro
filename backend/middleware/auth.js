const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success:   false,
        message:   'Access denied. No token provided.',
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success:   false,
        message:   'Invalid or expired token. Please login again.',
        timestamp: new Date().toISOString(),
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success:   false,
        message:   'User profile not found.',
        timestamp: new Date().toISOString(),
      });
    }

    if (profile.is_banned) {
      logger.security('BANNED_USER_ACCESS', user.id, { reason: profile.ban_reason });
      return res.status(403).json({
        success:   false,
        message:   'Account banned. Reason: ' + (profile.ban_reason || 'Violation of terms.'),
        timestamp: new Date().toISOString(),
      });
    }

    req.user = { ...user, profile };
    next();

  } catch (err) {
    logger.error('AUTH', err.message);
    return res.status(500).json({
      success:   false,
      message:   'Authentication failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.profile.role)) {
      return res.status(403).json({
        success:   false,
        message:   'Access denied. Required role: ' + roles.join(' or '),
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
