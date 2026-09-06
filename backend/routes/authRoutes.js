const express = require('express');
const { register, login, getUserProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', register);
router.post('/login', loginRateLimiter, login);
router.get('/profile', protect, getUserProfile);

module.exports = router;