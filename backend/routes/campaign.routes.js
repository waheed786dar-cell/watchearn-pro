const express     = require('express');
const router      = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const rateLimit   = require('express-rate-limit');
const {
  createCampaign,
  getMyCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
} = require('../controllers/campaign.controller');

const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success:   false,
    message:   'Max 5 campaigns per hour allowed.',
    timestamp: new Date().toISOString(),
  },
});

router.use(protect);

router.get('/',          getMyCampaigns);
router.get('/:id',       getCampaignById);
router.get('/:id/stats', getCampaignStats);
router.post('/',         restrictTo('advertiser','admin'), campaignLimiter, createCampaign);
router.patch('/:id',     restrictTo('advertiser','admin'), updateCampaign);
router.delete('/:id',    restrictTo('advertiser','admin'), deleteCampaign);

module.exports = router;
