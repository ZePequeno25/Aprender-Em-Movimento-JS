const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const addQuestion = async (questionData) => {
    try {
        const docRef = await db.collection('questions').add({
        ...questionData,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        visibility: questionData.visibility || 'public'
        });
        console.log(`✅ [questionModel] Questão criada: ${docRef.id}`);
        return docRef.id;

    } catch (error) {
        console.error(`Erro ao adicionar questão: ${error.message}`);
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
    try {
        await db.collection('questions').doc(questionId).update({
            ...questionData,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ [questionModel] Questão atualizada: ${questionId}`);

    } catch (error) {
        console.error(`Erro ao atualizar questão ${questionId}: ${error.message}`);
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