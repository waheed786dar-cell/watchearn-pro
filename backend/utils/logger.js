// ============================================
// utils/logger.js
// PRO — Structured Request + Error Logger
// ============================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LEVEL = process.env.NODE_ENV === 'production'
  ? LOG_LEVELS.WARN
  : LOG_LEVELS.DEBUG;

const colors = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[37m',
  bold:   '\x1b[1m',
};

const timestamp = () => new Date().toISOString();

const logger = {

  error: (context, message, meta = {}) => {
    if (CURRENT_LEVEL < LOG_LEVELS.ERROR) return;
    console.error(
      `${colors.red}${colors.bold}[ERROR]${colors.reset} ` +
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.cyan}[${context}]${colors.reset} ` +
      `${colors.red}${message}${colors.reset}`,
      Object.keys(meta).length ? meta : ''
    );
  },

  warn: (context, message, meta = {}) => {
    if (CURRENT_LEVEL < LOG_LEVELS.WARN) return;
    console.warn(
      `${colors.yellow}[WARN] ${colors.reset}` +
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.cyan}[${context}]${colors.reset} ` +
      `${colors.yellow}${message}${colors.reset}`,
      Object.keys(meta).length ? meta : ''
    );
  },

  info: (context, message, meta = {}) => {
    if (CURRENT_LEVEL < LOG_LEVELS.INFO) return;
    console.info(
      `${colors.green}[INFO]${colors.reset}  ` +
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.cyan}[${context}]${colors.reset} ` +
      `${message}`,
      Object.keys(meta).length ? meta : ''
    );
  },

  debug: (context, message, meta = {}) => {
    if (CURRENT_LEVEL < LOG_LEVELS.DEBUG) return;
    console.debug(
      `${colors.gray}[DEBUG] ${timestamp()} [${context}] ${message}${colors.reset}`,
      Object.keys(meta).length ? meta : ''
    );
  },

  // ── HTTP Request Logger Middleware ──
  requestLogger: (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status   = res.statusCode;

      const color = status >= 500 ? colors.red
                  : status >= 400 ? colors.yellow
                  : status >= 300 ? colors.cyan
                  : colors.green;

      console.log(
        `${color}${colors.bold}${req.method}${colors.reset} ` +
        `${req.originalUrl} ` +
        `${color}${status}${colors.reset} ` +
        `${colors.gray}${duration}ms${colors.reset} ` +
        `${colors.gray}${req.ip}${colors.reset}`
      );
    });

    next();
  },

  // ── Security Event Logger ──
  security: (event, userId, details = {}) => {
    console.warn(
      `${colors.red}${colors.bold}[SECURITY]${colors.reset} ` +
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.yellow}${event}${colors.reset} ` +
      `user:${userId}`,
      details
    );
  },
};

module.exports = logger;
