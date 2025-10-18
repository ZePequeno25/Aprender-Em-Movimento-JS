const express = require('express');
const router = express.Router();
const {
    addCommentHandler,
    getTeacherCommentsHandler,
    getStudentCommentsHandler,
    addCommentResponseHandler
} = require('../controllers/commentController');

router.post('/comments', addCommentHandler);
router.get('/teacher-comments/:teacherId', getTeacherCommentsHandler);
router.get('/student-comments/:studentId', getStudentCommentsHandler);
router.post('/comment-response', addCommentResponseHandler);

module.exports = router;