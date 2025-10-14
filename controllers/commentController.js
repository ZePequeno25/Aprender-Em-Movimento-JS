const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const { isProfessor, isStudent } = require('../models/userModel');
const { addComment, getTeacherComments, getStudentComments, addCommentResponse } = require('../models/commentModel');

const getCurrentUserId = async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Authentication token unavailable');
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

const isValidId = (id, paramName) => {
    if (!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0) {
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

const addCommentHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        const {questionId, questionTheme, questionText, userName, userTyoe, message} = req.body;
        if(!questionId || !questionTheme || !questionText || !userName || !userTyoe || !message){ //<-- Possivel problema
            return res.status(400).json({error: 'Missing required fields'});
        }
        if(!['aluno', 'professor'].includes(userTyoe)){
            return res.status(400).json({error: 'Invalid userType'});
        }
        const commentData = {
            question_id: questionId,
            question_theme: questionTheme,
            question_text: questionText,
            user_id: userId,
            user_name: userName,
            user_type: userTyoe,
            message
        };
        const commentId = await addComment(commentData);
        logger.info(`Comentário adicionado por ${userId} com ID: ${commentId} no questionario: ${questionId}`);
        res.status(201).json({message: 'Comment added successfully', id: commentId});

    }catch (error){
        logger.error(`Erro ao adicionar comentário: ${error.message}`);
        res.status(500).json({error: error.message});
    }
};

const getTeacherCommentsHandler = async (req, res) => {
    try{
        const {teacherId} = req.params;
        if(!isValidId(teacherId, 'teacherId')){
            return res.status(400).json({error: 'Invalid teacherId'});
        }
        const userId = await getCurrentUserId(req);
        if(userId !== teacherId || !await isProfessor(userId)){
            return res.status(403).json({error: 'Access denied'});
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
            return res.status(400).json({error: 'Invalid studentId'});
        }
        const userId = await getCurrentUserId(req);
        if(userId !== studentId || !await isStudent(userId)){
            return res.status(403).json({error: 'Access denied'});
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
            return res.status(400).json({error: 'Missing required fields'});
        }
        if(!['aluno', 'professor'].includes(userType)){
            return res.status(400).json({error: 'Invalid userType'});
        }
        const commentDoc = await db.collection('comments').doc(commentId).get();
        if(!commentDoc.exists){
            return res.status(404).json({error: 'Comment not found'});
        }
        const relationData = {
            comment_id: commentId,
            user_id: userId,
            user_name: userName,
            user_type: userType,
            message
        };
        const responseId = await addCommentResponse(responseData);
        logger.info(`Resposta adicionada por ${userId} com ID: ${responseId} ao comentário: ${commentId}`);
        res.status(201).json({message: 'Response added successfully', id: responseId});

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
