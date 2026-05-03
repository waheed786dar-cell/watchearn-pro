require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const logger     = require('./utils/logger');
const { globalErrorHandler } = require('./utils/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────
// SECURITY
// ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://www.youtube.com"],
      frameSrc:   ["https://www.youtube.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin:         process.env.NODE_ENV === 'production'
                    ? process.env.FRONTEND_URL
                    : '*',
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
}));

// ─────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { success: false, message: 'Too many requests. Try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many login attempts. Try after 1 hour.' },
});

app.use(globalLimiter);

// ─────────────────────────────────────────
// BODY PARSERS
// ─────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─────────────────────────────────────────
// REQUEST LOGGER
// ─────────────────────────────────────────
app.use(logger.requestLogger);

// ─────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes');
const taskRoutes     = require('./routes/tasks.routes');
const walletRoutes   = require('./routes/wallet.routes');
const withdrawRoutes = require('./routes/withdraw.routes');
const campaignRoutes = require('./routes/campaign.routes');
const adminRoutes    = require('./routes/admin.routes');

app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/wallet',    walletRoutes);
app.use('/api/withdraw',  withdrawRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/admin',     adminRoutes);

// ─────────────────────────────────────────
// API 404
// ─────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({
    success:   false,
    message:   `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────
// STATIC + FRONTEND
// ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER — must be last
// ─────────────────────────────────────────
app.use(globalErrorHandler);

// ─────────────────────────────────────────
// UNHANDLED REJECTIONS + EXCEPTIONS
// ─────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('PROCESS', 'Unhandled Promise Rejection', { reason });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('PROCESS', 'Uncaught Exception', { error: err.message });
  process.exit(1);
});

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('SERVER', `WatchEarn Pro Running`, {
    port: PORT,
    mode: process.env.NODE_ENV,
  });
  console.log('═══════════════════════════════════');
  console.log(`🚀 WatchEarn Pro Server Running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV}`);
  console.log('═══════════════════════════════════');
});

module.exports = app;
