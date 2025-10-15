const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify_user_for_password_reset', authController.verifyUserForPasswordResetHandler);
router.post('/reset-password', authController.resetPassword);
/**router.get('/verify-user', authController.verifyUser);
**/
module.exports = router;