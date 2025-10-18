const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { 
    addQuestionHandler, 
    getQuestionsHandler, 
    editQuestionHandler, 
    deleteQuestionHandler,
    updateQuestionVisibilityHandler
} = require('../controllers/questionController');

router.post('/questions/add', authMiddleware, addQuestionHandler);
router.get('/questions', getQuestionsHandler);
router.put('/questions/:questionId', authMiddleware, editQuestionHandler);
router.delete('/questions/:questionId', authMiddleware, deleteQuestionHandler);
router.patch('/questions/visibility', authMiddleware, updateQuestionVisibilityHandler);

module.exports = router;