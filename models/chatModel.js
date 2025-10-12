const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const addChatMessage = async (messageData) => {
    try{
        const docRef = await db.collection('chatMessages').add({
            ...messageData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;

    }catch(error){
        logger.error(`Erro ao adicionar mensagem de chat: ${error.message}`);
        throw error;
    }
};

const getChatMessages = async (senderId, receiverId) => {
    try{
        const snapshot1 = await db.collection('chats')
            .where('sender_id', '==', senderId)
            .where('receiver_id', '==', receiverId)
            .orderBy('created_at')
            .get();
        const snapshot2 = await db.collection('chats')
            .where('sender_id', '==', receiverId)
            .where('receiver_id', '==', senderId)
            .orderBy('created_at')
            .get();
        const messages = [...snapshot1.docs, ...snapshot2.docs]
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : null
            }))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return messages;

    }catch(error){
        logger.error(`Erro ao buscar mensagens de chat: ${error.message}`);
        throw error;
    }
};

module.exports = {
    addChatMessage,
    getChatMessages
};