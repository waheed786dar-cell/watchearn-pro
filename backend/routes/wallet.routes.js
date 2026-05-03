const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/auth');
const rateLimit    = require('express-rate-limit');
const {
  getWallet,
  getTransactions,
  getEarningStats,
} = require('../controllers/wallet.controller');

const walletLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: {
    success:   false,
    message:   'Too many wallet requests. Try again later.',
    timestamp: new Date().toISOString(),
  },
});

router.use(protect);
router.use(walletLimiter);

router.get('/',             getWallet);
router.get('/transactions', getTransactions);
router.get('/stats',        getEarningStats);

module.exports = router;
