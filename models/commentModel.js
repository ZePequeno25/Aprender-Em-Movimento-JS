const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const addComment = async (commentData) => {
    try{
        const docRef = await db.collection('comments').add({
            ...commentData,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    }catch (error){
        logger.error(`Erro ao adicionar comentário: ${error.message}`);
        throw error;
    }
};

const getTeacherComments = async (teacherId) => {
  try {
    const studentSnapshot = await db.collection('teacher_students')
      .where('teacher_id', '==', teacherId)
      .get();
    const studentIds = studentSnapshot.docs.map(doc => doc.data().student_id);
    
    if (!studentIds.length) return [];

    const comments = [];
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10);
      const commentsSnapshot = await db.collection('comments')
        .where('user_id', 'in', batch)
        .orderBy('created_at')
        .get();
        
      for (const doc of commentsSnapshot.docs) {
        const commentData = doc.data();
        
        // ✅ Buscar respostas da coleção CORRETA (comments-responses)
        let responses = [];
        try {
          const responsesSnapshot = await db.collection('comments-responses')
            .where('comment_id', '==', doc.id)
            .orderBy('created_at')
            .get();
            
          responses = responsesSnapshot.docs.map(r => ({
            id: r.id,
            ...r.data(),
            created_at: r.data().created_at ? r.data().created_at.toDate().toISOString() : null
          }));
        } catch (error) {
          console.warn(`⚠️ [commentModel] Erro ao buscar respostas: ${error.message}`);
        }
        
        comments.push({
          id: doc.id,
          ...commentData,
          created_at: commentData.created_at ? commentData.created_at.toDate().toISOString() : null,
          responses
        });
      }
    }
    return comments;
  } catch (error) {
    console.error(`Erro ao listar comentários do professor ${teacherId}: ${error.message}`);
    throw error;
  }
};

const getStudentComments = async (studentId) => {
    try{
        const snapshot = await db.collection('comments')
            .where('user_id', '==', studentId)
            .orderBy('created_at')
            .get();
            
        const comments = [];
        for(const doc of snapshot.docs){
            const commentData = doc.data();
            
            // ✅ Buscar respostas da coleção CORRETA
            const responsesSnapshot = await db.collection('comments-responses')
                .where('comment_id', '==', doc.id)
                .orderBy('created_at')
                .get();
                
            const responses = responsesSnapshot.docs.map(r => ({
                id: r.id,
                ...r.data(),
                created_at: r.data().created_at ? r.data().created_at.toDate().toISOString() : null
            }));
            
            comments.push({
                id: doc.id,
                ...commentData,
                created_at: commentData.created_at ? commentData.created_at.toDate().toISOString() : null,
                responses
            });
        }
        return comments;
    }catch (error){
        logger.error(`Erro ao listar comentários do aluno ${studentId}: ${error.message}`);
        throw error;
    }
};

const addCommentResponse = async (responseData) => {
    try{
        const docRef = await db.collection('comments-responses').add({ // ✅ Coleção correta
            ...responseData,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    }catch (error){
        logger.error(`Erro ao adicionar resposta ao comentário: ${error.message}`);
        throw error;
    }
};

module.exports = { addComment, getTeacherComments, getStudentComments, addCommentResponse };