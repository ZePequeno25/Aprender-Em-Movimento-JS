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

router.use(authMiddleware); // ✅ Aplica a TODAS as rotas

router.post('/questions', addQuestionHandler);
router.get('/questions', getQuestionsHandler);
router.put('/questions/:questionId', editQuestionHandler);
router.delete('/questions/:questionId', deleteQuestionHandler);
router.patch('/questions/:questionId/visibility', updateQuestionVisibilityHandler);

module.exports = router;