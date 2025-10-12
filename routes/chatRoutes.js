const express = require('express');
const router = express.Router();
const {addChatMessageHandler, getChatMessagesHandler} = require('../controllers/chatController');

router.post('/chat', addChatMessageHandler);
router.get('/chat/:senderId/:receiverId', getChatMessagesHandler);

module.exports = router;