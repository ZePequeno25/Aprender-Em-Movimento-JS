const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const {addChatMessage, getChatMessages} = require('../models/chatModel');
const {isProfessor, isStudent, getUserName} = require('../models/userModel');

const getCurrentUserId = async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if(!token) throw new Error('No token provided');
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

const isValidId = (id) => {
    if(!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0){
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

const addChatMessageHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        const {receiverId, message} = req.body;
        if(!receiverId || !message){
            return res.status(400).json({error: 'Missing required fields'});
        }
        if(!isValidId(receiverId)){
            return res.status(400).json({error: 'Invalid user ID'});
        }
        const userType = (await isProfessor(userId)) ? 'professor' : (await isStudent(userId)) ? 'aluno' : null;
        if(!userType){
            return res.status(403).json({error: 'Only teachers and students can send messages'});
        }
        const messageData = {
            sender_id: userId,
            sender_name: await getUserName(userId),
            sender_type: userType,
            receiver_id: receiverId,
            message
        };
        const messageId = await addChatMessage(messageData);
        logger.info(`Mensagem de chat adicionada: ${messageId} por ${userId}`);
        res.status(201).json({message: 'Message sent', id: messageId});

    }catch(error){
        logger.error('Erro ao enviar mensagem de chat', error);
        res.status(500).json({error: 'Internal server error'});
    }
};

const getChatMessagesHandler = async (req, res) => {
    try{
        const {sendrId, receiverId} = req.query;
        if(!isValidId(sendrId, 'sender_id' ) || !isValidId(receiverId, 'receiver_id')){
            return res.status(400).json({error: 'Invalid sender or recipient IDs'});
        }
        const userId = await getCurrentUserId(req);
        if(userId !== sendrId && userId !== receiverId){
            return res.status(403).json({error: 'You can only view your own messages'});
        }
        const messages = await getChatMessages(sendrId, receiverId);
        res.status(200).json(messages);

    }catch(error){
        logger.error(`Erro ao listar mensagens de chat: ${error.message}`);
        res.status(500).json({error: error.message});
    }
};

module.exports = {
    addChatMessageHandler,
    getChatMessagesHandler
};