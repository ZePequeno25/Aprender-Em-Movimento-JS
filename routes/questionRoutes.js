const express = require('express');
const router = express.Router();
const { 
    addQuestionHandler, 
    getQuestionsHandler, 
    editQuestionHandler, 
    deleteQuestionHandler,
    updateQuestionVisibilityHandler
} = require('../controllers/questionController');

router.post('/questions', addQuestionHandler);
router.get('/questions', getQuestionsHandler);
router.put('/questions/:questionId', editQuestionHandler);
router.delete('/questions/:questionId', deleteQuestionHandler);
router.patch('/questions/visibility', updateQuestionVisibilityHandler);

module.exports = router;