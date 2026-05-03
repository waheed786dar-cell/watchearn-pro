const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/auth');
const rateLimit   = require('express-rate-limit');
const {
  requestWithdrawal,
  getWithdrawals,
  cancelWithdrawal,
} = require('../controllers/withdraw.controller');

const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success:   false,
    message:   'Max 3 withdrawal requests per hour allowed.',
    timestamp: new Date().toISOString(),
  },
});

router.use(protect);

router.get('/',             getWithdrawals);
router.post('/',            withdrawLimiter, requestWithdrawal);
router.patch('/:id/cancel', cancelWithdrawal);

module.exports = router;
