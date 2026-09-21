const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protectUser } = require('../middlewares/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protectUser, getMe);

module.exports = router;
