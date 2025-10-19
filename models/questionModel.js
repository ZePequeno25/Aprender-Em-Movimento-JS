const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const addQuestion = async (questionData) => {
    try {
        const docRef = await db.collection('questions').add({
            ...questionData,
            created_at: admin.firestore.FieldValue.serverTimestamp(), // ✅ Campo correto
            visibility: questionData.visibility || 'public'
        });
        console.log(`✅ [questionModel] Questão criada: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        console.error(`Erro ao adicionar questão: ${error.message}`);
        throw error;
    }
};

const getQuestions = async () => {
    try{
        const snapshot = await db.collection('questions').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : null,
            updated_at: doc.data().updated_at ? doc.data().updated_at.toDate().toISOString() : null
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
            updated_at: admin.firestore.FieldValue.serverTimestamp() // ✅ Campo correto
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
        console.log(`✅ [questionModel] Questão deletada: ${questionId}`);
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