const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const addQuestion = async (questionData) => {
    try{
        const docRef = await db.collection('questions').add({
            ...questionData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;

    }catch (error){
        logger.error(`Erro ao adicionar pergunta: ${error.message}`);
        throw error;
    }
};

const getQuestions = async ()=>{
    try{
        const snapshot = await db.collection('questions').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : null,
            update_at: doc.data().update_at ? doc.data().update_at.toDate().toISOString() : null
        }));

    }catch (error){
        logger.error(`Erro ao listar perguntas: ${error.message}`);
        throw error;
    }
};

const updateQuestion = async (questionId, questionData) => {
    try{
        await db.collection('questions').doc(questionId).update({
            ...questionData,
            update_at: admin.firestore.FieldValue.serverTimestamp()
        });

    }catch (error){
        logger.error(`Erro ao atualizar pergunta ${questionId}: ${error.message}`);
        throw error;
    }
};

const deleteQuestion = async (questionId) => {
    try{
        await db.collection('questions').doc(questionId).delete();

    }catch (error){
        logger.error(`Erro ao deletar pergunta ${questionId}: ${error.message}`);
        throw error;
    }
};

module.exports = {
    addQuestion,
    getQuestions,
    updateQuestion,
    deleteQuestion
};