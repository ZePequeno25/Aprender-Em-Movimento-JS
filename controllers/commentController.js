const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { isProfessor, isStudent } = require('../models/userModel');
const { addComment, getTeacherComments, getStudentComments, addCommentResponse } = require('../models/commentModel');

const getCurrentUserId = async (req) => {
    
    if (!req.userId) {
        throw new Error('Usuário não autenticado - middleware não aplicado');
    }
    return req.userId;
};

const isValidId = (id, paramName) => {
    if (!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0) {
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

const addCommentHandler = async (req, res) => {
    logger.info('💭 [commentController] Iniciando adição de comentário', 'COMMENTS');
    
    try{
        const userId = await getCurrentUserId(req);
        logger.info(`👤 [commentController] Usuário autenticado: ${userId}`, 'COMMENTS');
        
        const {questionId, questionTheme, questionText, userName, userType, message} = req.body;
        logger.info(`📊 [commentController] Dados: questionId=${questionId}, theme=${questionTheme}, userName=${userName}`, 'COMMENTS');
        
        if(!questionId || !questionTheme || !questionText || !userName || !userType || !message){ 
            logger.warn('❌ [commentController] Campos obrigatórios faltando', 'COMMENTS');
            return res.status(400).json({error: 'Campos obrigatórios ausentes'});
        }
        if(!['aluno', 'professor'].includes(userType)){
            logger.warn(`❌ [commentController] userType inválido: ${userType}`, 'COMMENTS');
            return res.status(400).json({error: 'Tipo de usuário inválido'});
        }
        const commentData = {
            question_id: questionId,
            question_theme: questionTheme,
            question_text: questionText,
            user_id: userId,
            user_name: userName,
            user_type: userType,
            message
        };
        const commentId = await addComment(commentData);
        logger.info(`✅ [commentController] Comentário adicionado: ${commentId}`, 'COMMENTS');
        res.status(201).json({message: 'Comentário adicionado com sucesso', id: commentId});

    }catch (error){
        logger.error(`Erro ao adicionar comentário`, error, 'COMMENTS');
        res.status(500).json({error: error.message});
    }
};

const getTeacherCommentsHandler = async (req, res) => {
    try{
        const {teacherId} = req.params;
        if(!isValidId(teacherId, 'teacherId')){
            return res.status(400).json({error: 'TeacherId inválido'});
        }
        const userId = await getCurrentUserId(req);
        if(userId !== teacherId || !await isProfessor(userId)){
            return res.status(403).json({error: 'Acesso negado'});
        }
        const comments = await getTeacherComments(teacherId);
        res.status(200).json({comments});
    }catch (error){
        logger.error(`Erro ao listar comentários do professor ${teacherId}: ${error.message}`);
        res.status(500).json({error: error.message});
    }
};

const getStudentCommentsHandler = async (req, res) => {
    try{
        const {studentId} = req.params;
        if(!isValidId(studentId, 'studentId')){
            return res.status(400).json({error: 'StudentId inválido'});
        }
        const userId = await getCurrentUserId(req);
        if(userId !== studentId || !await isStudent(userId)){
            return res.status(403).json({error: 'Acesso negado'});
        }
        const comments = await getStudentComments(studentId);
        res.status(200).json({comments});
    }catch (error){
        logger.error(`Erro ao listar comentários do aluno ${studentId}: ${error.message}`);
        res.status(500).json({error: error.message});
    }
};

const addCommentResponseHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        const {commentId, userName, userType, message} = req.body;
        if(!commentId || !userName || !userType || !message){
            return res.status(400).json({error: 'Campos obrigatórios ausentes'});
        }
        if(!['aluno', 'professor'].includes(userType)){
            return res.status(400).json({error: 'Tipo de usuário inválido'});
        }
        const commentDoc = await db.collection('comments').doc(commentId).get();
        if(!commentDoc.exists){
            return res.status(404).json({error: 'Comentário não encontrado'});
        }
        const relationData = {
            comment_id: commentId,
            user_id: userId,
            user_name: userName,
            user_type: userType,
            message
        };
        const responseId = await addCommentResponse(relationData);
        logger.info(`Resposta adicionada por ${userId} com ID: ${responseId} ao comentário: ${commentId}`);
        res.status(201).json({message: 'Resposta adicionada com sucesso', id: responseId});

    }catch (error){
        logger.error(`Erro ao adicionar resposta ao comentário: ${error.message}`);
        res.status(500).json({error: error.message});
    }
};

module.exports = {
    addCommentHandler,
    getTeacherCommentsHandler,
    getStudentCommentsHandler,
    addCommentResponseHandler
};
