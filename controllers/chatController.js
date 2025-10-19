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

const isValidId = (id, paramName) => {
    if(!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0){
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

const addChatMessageHandler = async (req, res) => {
    logger.info('💬 [chatController] Iniciando envio de mensagem de chat', 'CHAT');
    
    try{
        const userId = await getCurrentUserId(req);
        logger.info(`👤 [chatController] Usuário autenticado: ${userId}`, 'CHAT');
        
        const {receiverId, message} = req.body;
        logger.info(`📊 [chatController] Dados: receiverId=${receiverId}, message length=${message?.length}`, 'CHAT');
        
        if(!receiverId || !message){
            logger.warn('❌ [chatController] Campos obrigatórios faltando', 'CHAT');
            return res.status(400).json({error: 'Missing required fields'});
        }
        if(!isValidId(receiverId)){
            logger.warn(`❌ [chatController] receiverId inválido: ${receiverId}`, 'CHAT');
            return res.status(400).json({error: 'Invalid user ID'});
        }
        const userType = (await isProfessor(userId)) ? 'professor' : (await isStudent(userId)) ? 'aluno' : null;
        if(!userType){
            logger.warn(`❌ [chatController] Usuário ${userId} não é professor nem aluno`, 'CHAT');
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
        logger.info(`✅ [chatController] Mensagem enviada: ${messageId}`, 'CHAT');
        res.status(201).json({message: 'Message sent', id: messageId});

    }catch(error){
        logger.error('Erro ao enviar mensagem de chat', error, 'CHAT');
        res.status(500).json({error: 'Internal server error'});
    }
};

const getChatMessagesHandler = async (req, res) => {
    logger.info('📨 [chatController] Buscando mensagens de chat', 'CHAT');
    
    try{
        // ✅ CORRIGIDO: Usar query params
        const { senderId, receiverId } = req.query;
        logger.info(`📊 [chatController] Params: senderId=${senderId}, receiverId=${receiverId}`, 'CHAT');
        
        if(!isValidId(senderId, 'sender_id') || !isValidId(receiverId, 'receiver_id')){
            logger.warn(`❌ [chatController] IDs inválidos`, 'CHAT');
            return res.status(400).json({error: 'Invalid sender or recipient IDs'});
        }
        
        const userId = await getCurrentUserId(req);
        if(userId !== senderId && userId !== receiverId){
            logger.warn(`❌ [chatController] Usuário ${userId} sem permissão`, 'CHAT');
            return res.status(403).json({error: 'You can only view your own messages'});
        }
        
        const messages = await getChatMessages(senderId, receiverId);
        logger.info(`✅ [chatController] ${messages.length} mensagens encontradas`, 'CHAT');
        res.status(200).json(messages);

    }catch(error){
        logger.error(`Erro ao listar mensagens de chat`, error, 'CHAT');
        res.status(500).json({error: error.message});
    }
};

module.exports = {
    addChatMessageHandler,
    getChatMessagesHandler
};