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
    logger.info(`🔍 [commentModel] Encontrados ${studentIds.length} alunos para teacherId: ${teacherId}`, 'COMMENTS');
    if (!studentIds.length) {
      logger.info(`⚠️ [commentModel] Nenhum aluno vinculado encontrado`, 'COMMENTS');
      return [];
    }

    const commentsSnapshot = await db.collection('comments')
      .where('user_id', 'in', studentIds)
      .orderBy('created_at')
      .get();

    const comments = [];
    for (const doc of commentsSnapshot.docs) {
      const commentData = doc.data();
      let responses = [];
      try {
        const responsesSnapshot = await db.collection('comments').doc(doc.id).collection('responses').get();
        responses = responsesSnapshot.docs.map(r => ({
          id: r.id,
          commentId: r.data().comment_id,
          userId: r.data().user_id,
          userName: r.data().user_name,
          userType: r.data().user_type,
          message: r.data().message,
          createdAt: r.data().created_at ? r.data().created_at.toDate().toISOString() : null
        }));
      } catch (error) {
        logger.warn(`⚠️ [commentModel] Erro ao buscar respostas para comentário ${doc.id}: ${error.message}`, 'COMMENTS');
      }
      comments.push({
        id: doc.id,
        questionId: commentData.question_id,
        questionTheme: commentData.question_theme,
        questionText: commentData.question_text,
        userId: commentData.user_id,
        userName: commentData.user_name,
        userType: commentData.user_type,
        message: commentData.message,
        createdAt: commentData.created_at ? commentData.created_at.toDate().toISOString() : null,
        responses
      });
    }
    logger.info(`✅ [commentModel] ${comments.length} comentários encontrados`, 'COMMENTS');
    return comments;
  } catch (error) {
    logger.error(`Erro ao listar comentários do professor ${teacherId}: ${error.message}`, 'COMMENTS');
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