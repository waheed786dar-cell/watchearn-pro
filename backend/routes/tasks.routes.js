const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/auth');
const { fraudCheck } = require('../middleware/fraud');
const {
  getAllTasks,
  getTaskById,
  completeTask,
  getUserCompletions,
} = require('../controllers/tasks.controller');

router.get('/ping',           (req, res) => res.json({ ok: true }));
router.get('/',               protect, getAllTasks);
router.get('/my-completions', protect, getUserCompletions);
router.get('/:id',            protect, getTaskById);
router.post('/:id/complete',  protect, fraudCheck, completeTask);

module.exports = router;
