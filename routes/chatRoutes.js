const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {addChatMessageHandler, getChatMessagesHandler} = require('../controllers/chatController');

router.use(authMiddleware); // ✅ Aplica a todas as rotas

router.post('/chat', addChatMessageHandler);
router.get('/chat', getChatMessagesHandler); // ✅ Usar query params

module.exports = router;