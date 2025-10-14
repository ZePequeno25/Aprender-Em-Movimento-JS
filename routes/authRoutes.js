const express = require('express');
const router = express.Router();
const { register, login, verifyUserForPasswordResetHandler, resetPassword, verifyUser } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', verifyUserForPasswordResetHandler);
router.post('/resetpassword', resetPassword);
router.get('/verifyuser', verifyUser);

module.exports = router;