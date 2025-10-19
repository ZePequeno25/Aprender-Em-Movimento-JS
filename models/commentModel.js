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
    console.log(`🔍 [commentModel] Buscando alunos do professor: ${teacherId}`);
    
    // Buscar alunos vinculados ao professor
    const studentSnapshot = await db.collection('teacher_students')
      .where('teacher_id', '==', teacherId)
      .get();
    
    const studentIds = studentSnapshot.docs.map(doc => doc.data().student_id);
    console.log(`📊 [commentModel] ${studentIds.length} alunos encontrados para o professor`);
    
    if (!studentIds.length) return [];

    const comments = [];
    
    // Processar em batches de 10 (limite do Firestore)
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10);
      
      const commentsSnapshot = await db.collection('comments')
        .where('user_id', 'in', batch)
        .orderBy('created_at', 'desc')
        .get();
      
      console.log(`💬 [commentModel] ${commentsSnapshot.size} comentários no batch ${i/10 + 1}`);
      
      for (const doc of commentsSnapshot.docs) {
        const commentData = doc.data();
        
        // Buscar respostas
        let responses = [];
        try {
          const responsesSnapshot = await db.collection('comments-responses')
            .where('comment_id', '==', doc.id)
            .orderBy('created_at')
            .get();
            
          responses = responsesSnapshot.docs.map(r => ({
            id: r.id,
            comment_id: r.data().comment_id,
            user_id: r.data().user_id,
            user_name: r.data().user_name,
            user_type: r.data().user_type,
            message: r.data().message,
            created_at: r.data().created_at ? r.data().created_at.toDate().toISOString() : null
          }));
        } catch (error) {
          console.warn(`⚠️ [commentModel] Erro ao buscar respostas: ${error.message}`);
        }
        
        comments.push({
          id: doc.id,
          question_id: commentData.question_id,
          question_theme: commentData.question_theme,
          question_text: commentData.question_text,
          user_id: commentData.user_id,
          user_name: commentData.user_name,
          user_type: commentData.user_type,
          message: commentData.message,
          created_at: commentData.created_at ? commentData.created_at.toDate().toISOString() : null,
          responses
        });
      }
    }
    
    console.log(`✅ [commentModel] Total de ${comments.length} comentários retornados`);
    return comments;
    
  } catch (error) {
    console.error(`❌ [commentModel] Erro ao buscar comentários: ${error.message}`);
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
            const responsesSnapshot = await db.collection('comments_responses')
                .where('comment_id', '==', doc.id)
                .get();
            
                const responses = responsesSnapshot.docs.map(r => ({
                    id: r.id,
                    commentId: r.data().comment_id,
                    userId: r.data().user_id,
                    userName: r.data().user_name,
                    userType: r.data().user_type,
                    message: r.data().message,
                    createdAt: r.data().created_at ? r.data().created_at.toDate().toISOString(): null
                }));
                comments.push({
                    id: doc.id,
                    questionId: commentData.question_id,
                    questionTheme: commentData.question_theme,
                    questionText: commentData.question_text,
                    userId: commentData.user_id,
                    userName: commentData.user_name,
                    userType: commentData.user_type,
                    message: commentData.message,
                    createdAt: commentData.created_at ? commentData.created_at.toDate().toISOString(): null,
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
        const docRef = await db.collection('comments_responses').add({
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