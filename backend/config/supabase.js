// ============================================
// FILE 004 — config/supabase.js
// Two clients: public + admin (service role)
// ============================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE  = process.env.SUPABASE_SERVICE_KEY;

// Validate on startup
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

// Public client — for user-level operations (respects RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});

// Admin client — bypasses RLS (use carefully!)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase, supabaseAdmin };
