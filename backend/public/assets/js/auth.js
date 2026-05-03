/* ================================================
   auth.js — Session + Auth Manager
   ================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── Supabase Client ──
export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

// ── Auth Manager ──
export const Auth = {

  // Current session token
  _token: null,
  _user:  null,

  // ── Get current session ──
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this._token = session.access_token;
      this._user  = session.user;
    }
    return session;
  },

  // ── Google Login ──
  async loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider:  'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard.html`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  },

  // ── GitHub Login ──
  async loginWithGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/dashboard.html`,
      },
    });
    if (error) throw error;
  },

  // ── Logout ──
  async logout() {
    await supabase.auth.signOut();
    this._token = null;
    this._user  = null;
    window.location.href = '/index.html';
  },

  // ── Get token for API calls ──
  async getToken() {
    if (this._token) return this._token;
    const session = await this.getSession();
    return session?.access_token || null;
  },

  // ── Check if logged in ──
  async isLoggedIn() {
    const session = await this.getSession();
    return !!session;
  },

  // ── Require auth — redirect if not logged in ──
  async requireAuth() {
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },

  // ── Require guest — redirect if logged in ──
  async requireGuest() {
    const loggedIn = await this.isLoggedIn();
    if (loggedIn) {
      window.location.href = '/dashboard.html';
      return false;
    }
    return true;
  },

  // ── Get user role from profile ──
  async getRole() {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const res  = await API.get('/auth/profile');
      return res.data?.profile?.role || 'earner';
    } catch {
      return 'earner';
    }
  },

  // ── Listen to auth changes ──
  onAuthChange(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
      this._token = session?.access_token || null;
      this._user  = session?.user || null;
      callback(event, session);
    });
  },
};
