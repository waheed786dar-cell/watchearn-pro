// ============================================
// FILE 007 — routes/auth.routes.js
// Auth endpoints — login, profile, logout
// ============================================

const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  deleteAccount,
} = require('../controllers/auth.controller');

// Public
router.get('/ping', (req, res) => res.json({ ok: true }));

// Protected
router.get('/profile',         protect, getProfile);
router.patch('/profile',       protect, updateProfile);
router.delete('/account',      protect, deleteAccount);

module.exports = router;
