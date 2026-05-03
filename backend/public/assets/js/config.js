/* ================================================
   config.js — Supabase + API Configuration
   ================================================ */

const CONFIG = {
  SUPABASE_URL:      'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  API_BASE:          'http://localhost:3000/api',
  APP_NAME:          'WatchEarn Pro',
  VERSION:           '1.0.0',

  // Withdrawal limits
  MIN_WITHDRAW:      100,
  WITHDRAW_FEE_PCT:  5,

  // Task settings
  DAILY_TASK_LIMIT:  50,

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
};

// Freeze — prevent accidental mutation
Object.freeze(CONFIG);
