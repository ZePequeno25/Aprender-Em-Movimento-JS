const admin = require('firebase-admin');
const logger = require('../utils/logger');
const {isProfessor} = require('../models/userModel');
const {addQuestion, getQuestions, updateQuestion, deleteQuestion} = require('../models/questionModel');

const getCurrentUserId = (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if(!token) throw new Error('No token provided');
    const decodedToken = admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

const addQuestionHandler = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        if(!await isProfessor(userId)){
            return res.status(403).json({error: 'Only teachers can add questions'});
        }
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
            created_by: userId,
            updated_by: userId
        };
        const questionId = await addQuestion(questionData);
        logger.info(`Pergunta adicionada: ${questionId} por ${userId}`);
        res.status(201).json({message: 'Question added successfully', questionId});

    }catch(error){
        logger.error('Erro ao adicionar pergunta', error);
        res.status(500).json({error: 'Internal server error'});
    }
};

const getQuestionsHandler = async (req, res) => {
    try{
        const questions = await getQuestions();
        res.status(200).json(questions);
    }catch(error){
        logger.error('Erro ao buscar perguntas', error);
        res.status(500).json({error: 'Internal server error'});
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