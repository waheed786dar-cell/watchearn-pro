const express     = require('express');
const router      = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getDashboardStats,
  getAllUsers,
  banUser,
  unbanUser,
  getAllCampaigns,
  approveCampaign,
  rejectCampaign,
  getAllWithdrawals,
  processWithdrawal,
  getFraudFlags,
  resolveFlag,
} = require('../controllers/admin.controller');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats',                    getDashboardStats);
router.get('/users',                    getAllUsers);
router.patch('/users/:id/ban',          banUser);
router.patch('/users/:id/unban',        unbanUser);
router.get('/campaigns',                getAllCampaigns);
router.patch('/campaigns/:id/approve',  approveCampaign);
router.patch('/campaigns/:id/reject',   rejectCampaign);
router.get('/withdrawals',              getAllWithdrawals);
router.patch('/withdrawals/:id/process',processWithdrawal);
router.get('/fraud-flags',              getFraudFlags);
router.patch('/fraud-flags/:id/resolve',resolveFlag);

module.exports = router;
