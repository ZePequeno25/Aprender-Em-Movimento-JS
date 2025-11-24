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
    console.log(`🔍 [commentModel] Buscando comentários nas questões do professor: ${teacherId}`);
    
    // ✅ BUSCAR PELO DOCUMENT ID DO PROFESSOR
    let teacherDoc;
    try {
      teacherDoc = await db.collection('users').doc(teacherId).get();
      if (!teacherDoc.exists) {
        console.log(`❌ [commentModel] Professor não encontrado: ${teacherId}`);
        return [];
      }
    } catch (error) {
      console.error(`❌ [commentModel] Erro ao buscar professor: ${error.message}`);
      return [];
    }

    // ✅ Buscar questões criadas pelo professor
    let questionsSnapshot;
    try {
      questionsSnapshot = await db.collection('questions')
        .where('created_by', '==', teacherId)
        .get();
    } catch (error) {
      console.error(`❌ [commentModel] Erro ao buscar questões: ${error.message}`);
      return [];
    }
    
    const questionIds = questionsSnapshot.docs.map(doc => doc.id);
    console.log(`📊 [commentModel] ${questionIds.length} questões encontradas do professor`);
    
    if (!questionIds.length) {
      console.log(`ℹ️ [commentModel] Nenhuma questão encontrada para o professor`);
      return [];
    }

    const comments = [];
    
    // Processar em batches de 10 (limite do Firestore para 'in' queries)
    for (let i = 0; i < questionIds.length; i += 10) {
      const batch = questionIds.slice(i, i + 10);
      
      try {
        // Tentar buscar com orderBy primeiro
        let commentsSnapshot;
        try {
          commentsSnapshot = await db.collection('comments')
            .where('question_id', 'in', batch)
            .orderBy('created_at', 'desc')
            .get();
        } catch (orderByError) {
          // Se falhar por falta de índice, buscar sem orderBy e ordenar manualmente
          console.warn(`⚠️ [commentModel] Erro com orderBy, buscando sem ordenação: ${orderByError.message}`);
          commentsSnapshot = await db.collection('comments')
            .where('question_id', 'in', batch)
            .get();
        }
        
        console.log(`💬 [commentModel] ${commentsSnapshot.size} comentários no batch ${Math.floor(i/10) + 1}`);
        
        for (const doc of commentsSnapshot.docs) {
          const commentData = doc.data();
          
          // Buscar respostas (tentar ambas as coleções para compatibilidade)
          let responses = [];
          try {
            // Tentar primeiro comments-responses
            let responsesSnapshot;
            try {
              responsesSnapshot = await db.collection('comments-responses')
                .where('comment_id', '==', doc.id)
                .orderBy('created_at')
                .get();
            } catch (error) {
              // Se falhar, tentar sem orderBy
              responsesSnapshot = await db.collection('comments-responses')
                .where('comment_id', '==', doc.id)
                .get();
            }
            
            // Se não encontrar, tentar comments_responses
            if (responsesSnapshot.empty) {
              try {
                responsesSnapshot = await db.collection('comments_responses')
                  .where('comment_id', '==', doc.id)
                  .orderBy('created_at')
                  .get();
              } catch (error) {
                responsesSnapshot = await db.collection('comments_responses')
                  .where('comment_id', '==', doc.id)
                  .get();
              }
            }
              
            responses = responsesSnapshot.docs.map(r => ({
              id: r.id,
              comment_id: r.data().comment_id,
              user_id: r.data().user_id,
              user_name: r.data().user_name,
              user_type: r.data().user_type,
              message: r.data().message,
              created_at: r.data().created_at ? r.data().created_at.toDate().toISOString() : null
            }));
            
            // Ordenar manualmente se necessário
            responses.sort((a, b) => {
              if (!a.created_at || !b.created_at) return 0;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
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
      } catch (error) {
        console.error(`❌ [commentModel] Erro ao buscar comentários do batch: ${error.message}`);
        // Continuar com o próximo batch mesmo se houver erro
      }
    }
    
    // Ordenar comentários por data (mais recentes primeiro) se não foi possível usar orderBy
    comments.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    console.log(`✅ [commentModel] Total de ${comments.length} comentários retornados`);
    return comments;
    
  } catch (error) {
    console.error(`❌ [commentModel] Erro ao buscar comentários: ${error.message}`);
    throw error;
  }
};

const getStudentComments = async (studentId) => {
    try{
        console.log(`🔍 [commentModel] Buscando comentários do aluno: ${studentId}`);
        
        // Tentar buscar com orderBy primeiro
        let snapshot;
        try {
            snapshot = await db.collection('comments')
                .where('user_id', '==', studentId)
                .orderBy('created_at', 'desc')
                .get();
        } catch (orderByError) {
            // Se falhar por falta de índice, buscar sem orderBy e ordenar manualmente
            console.warn(`⚠️ [commentModel] Erro com orderBy, buscando sem ordenação: ${orderByError.message}`);
            snapshot = await db.collection('comments')
                .where('user_id', '==', studentId)
                .get();
        }
        
        console.log(`📊 [commentModel] ${snapshot.size} comentários encontrados do aluno`);
        
        const comments = [];
        for(const doc of snapshot.docs){
            const commentData = doc.data();
            
            // Buscar respostas (tentar ambas as coleções para compatibilidade)
            let responses = [];
            try {
                // Tentar primeiro comments-responses
                let responsesSnapshot;
                try {
                    responsesSnapshot = await db.collection('comments-responses')
                        .where('comment_id', '==', doc.id)
                        .orderBy('created_at')
                        .get();
                } catch (error) {
                    // Se falhar, tentar sem orderBy
                    responsesSnapshot = await db.collection('comments-responses')
                        .where('comment_id', '==', doc.id)
                        .get();
                }
                
                // Se não encontrar, tentar comments_responses
                if (responsesSnapshot.empty) {
                    try {
                        responsesSnapshot = await db.collection('comments_responses')
                            .where('comment_id', '==', doc.id)
                            .orderBy('created_at')
                            .get();
                    } catch (error) {
                        responsesSnapshot = await db.collection('comments_responses')
                            .where('comment_id', '==', doc.id)
                            .get();
                    }
                }
            
                responses = responsesSnapshot.docs.map(r => ({
                    id: r.id,
                    commentId: r.data().comment_id,
                    userId: r.data().user_id,
                    userName: r.data().user_name,
                    userType: r.data().user_type,
                    message: r.data().message,
                    createdAt: r.data().created_at ? r.data().created_at.toDate().toISOString(): null
                }));
                
                // Ordenar manualmente se necessário
                responses.sort((a, b) => {
                    if (!a.createdAt || !b.createdAt) return 0;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });
            } catch (error) {
                console.warn(`⚠️ [commentModel] Erro ao buscar respostas: ${error.message}`);
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
                createdAt: commentData.created_at ? commentData.created_at.toDate().toISOString(): null,
                responses
            });
        }
        
        // Ordenar comentários por data (mais recentes primeiro) se não foi possível usar orderBy
        comments.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        console.log(`✅ [commentModel] Total de ${comments.length} comentários retornados do aluno`);
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