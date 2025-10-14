const express = require('express');
const router = express.Router();
const { register, login, verifyUserForPasswordResetHandler, resetPassword, verifyUser } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-user', verifyUserForPasswordResetHandler);
router.post('/reset-password', resetPassword);
router.get('/verify-user', verifyUser);

module.exports = router;