
const express = require('express');
const { updateUserProfile, getAllUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.put('/profile', protect, updateUserProfile);
router.get('/', protect, getAllUsers);

module.exports = router;