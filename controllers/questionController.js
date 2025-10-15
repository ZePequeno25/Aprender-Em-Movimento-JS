const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const {isProfessor} = require('../models/userModel');
const {addQuestion, getQuestions, updateQuestion, deleteQuestion} = require('../models/questionModel');

const getCurrentUserId = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided');
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('🔐 [questionController] Verificando token...');
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('✅ [questionController] Token válido para usuário:', decodedToken.uid);
    
    return decodedToken.uid;
  } catch (error) {
    console.error('❌ [questionController] Erro ao verificar token:', error);
    throw new Error('Token inválido');
  }
};

const addQuestionHandler = async (req, res) => {
  console.log('📝 [questionController] Iniciando adição de questão...');
  
  try {
    const userId = await getCurrentUserId(req);
    console.log('👤 [questionController] Usuário autenticado:', userId);
    
    const isUserProfessor = await isProfessor(userId);
    if (!isUserProfessor) {
      console.log('❌ [questionController] Usuário não é professor');
      return res.status(403).json({ error: 'Apenas professores podem adicionar questões' });
    }

    const { theme, question_text, options_json, correct_option_index, feedback_title, feedback_illustration, feedback_text } = req.body;
    
    console.log('📊 [questionController] Dados recebidos:', {
      theme,
      question_text: question_text?.substring(0, 50) + '...',
      options_json: options_json ? 'fornecido' : 'não fornecido',
      correct_option_index,
      has_feedback: !!feedback_text
    });

    // Validações
    if (!theme || !question_text || !options_json || correct_option_index === undefined) {
      console.log('❌ [questionController] Campos obrigatórios faltando');
      return res.status(400).json({ error: 'Campos obrigatórios faltando: theme, question_text, options_json, correct_option_index' });
    }

    // Validar que options_json é um array válido
    let options;
    try {
      options = typeof options_json === 'string' ? JSON.parse(options_json) : options_json;
      if (!Array.isArray(options) || options.length === 0) {
        throw new Error('options_json deve ser um array não vazio');
      }
    } catch (error) {
      console.log('❌ [questionController] options_json inválido:', error.message);
      return res.status(400).json({ error: 'options_json deve ser um JSON array válido' });
    }

    const questionData = {
      theme: theme.toLowerCase().trim(),
      question_text,
      options_json: options, // ✅ Agora é um array
      correct_option_index: parseInt(correct_option_index),
      feedback_title: feedback_title || '',
      feedback_illustration: feedback_illustration || '',
      feedback_text: feedback_text || '',
      created_by: userId,
      updated_by: userId,
      visibility: 'private', // ✅ Valor padrão
      createdAt: new Date().toISOString()
    };

    console.log('💾 [questionController] Salvando questão...');
    const questionId = await addQuestion(questionData);
    
    logger.info(`Pergunta adicionada: ${questionId} por ${userId}`, 'QUESTIONS');
    console.log('✅ [questionController] Questão adicionada com sucesso:', questionId);

    res.status(201).json({ 
      message: 'Questão adicionada com sucesso', 
      questionId,
      data: {
        id: questionId,
        ...questionData
      }
    });

  } catch (error) {
    console.error('❌ [questionController] Erro ao adicionar pergunta:', error);
    logger.error('Erro ao adicionar pergunta', error, 'QUESTIONS');
    
    if (error.message === 'Token inválido' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Token de autenticação inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getQuestionsHandler = async (req, res) => {
  console.log('📚 [questionController] Buscando todas as questões...');
  
  try {
    const questions = await getQuestions();
    console.log(`✅ [questionController] ${questions.length} questões encontradas`);
    
    // ✅ Formatar para o frontend
    const formattedQuestions = questions.map(q => ({
      id: q.id,
      theme: q.theme,
      question: q.question_text, // ✅ Mapear para o nome que o frontend espera
      options: q.options_json,   // ✅ Já é um array
      correctOptionIndex: q.correct_option_index,
      feedback: {
        title: q.feedback_title,
        text: q.feedback_text,
        illustration: q.feedback_illustration
      },
      createdBy: q.created_by,
      visibility: q.visibility || 'private',
      createdAt: q.createdAt
    }));

    res.status(200).json(formattedQuestions);
  } catch (error) {
    console.error('❌ [questionController] Erro ao buscar perguntas:', error);
    logger.error('Erro ao buscar perguntas', error, 'QUESTIONS');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const editQuestionHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        if(!await isProfessor(userId)){
            return res.status(403).json({error: 'Only teachers can edit questions'});
        };
        const {questionId} = req.params;
        const {theme, question_text, options_json, correct_option_index, feedback_title, feedback_illustration, feedback_text} = req.body;
        if(!theme || !question_text || !options_json || correct_option_index === null){
            return res.status(400).json({error: 'Missing required fields'});
        }
        const questionData = {
            theme: theme.toLowerCase(),
            question_text,
            options_json,
            correct_option_index,
            feedback_title: feedback_title || '',
            feedback_illustration: feedback_illustration || '',
            feedback_text: feedback_text || '',
            updated_by: userId
        };
        await updateQuestion(questionId, questionData);
        logger.info(`Pergunta editada: ${questionId} por ${userId}`);
        res.status(200).json({message: 'Question updated successfully'});

    }catch(error){
        logger.error('Erro ao editar pergunta', error);
        res.status(500).json({error: 'Internal server error'});
    }
};

const deleteQuestionHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        if(!await isProfessor(userId)){
            return res.status(403).json({error: 'Only teachers can delete questions'});
        };
        const {questionId} = req.params;
        await deleteQuestion(questionId);
        logger.info(`Pergunta deletada: ${questionId} por ${userId}`);
        res.status(200).json({message: 'Question deleted successfully'});

    }catch(error){
        logger.error('Erro ao deletar pergunta', error);
        res.status(500).json({error: 'Internal server error'});
    }
};

module.exports = {addQuestionHandler, getQuestionsHandler, editQuestionHandler, deleteQuestionHandler};