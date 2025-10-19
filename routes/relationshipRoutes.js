const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
    generateTeacherCode,
    getTeacherCodeHandler,
    linkStudentByCode,
    getTeacherStudentsHandler,
    getStudentRelationsHandler,
    unlinkStudent,
    getStudentsHandler
} = require('../controllers/relationshipController');

router.use(authMiddleware); // ✅ Aplica a TODAS as rotas

router.post('/teacher-code', generateTeacherCode);
router.get('/teacher-code/:teacherId', getTeacherCodeHandler);
router.post('/link-student', linkStudentByCode);
router.get('/teacher-students/:teacherId', getTeacherStudentsHandler);
router.get('/teacher-relations/:studentId', getStudentRelationsHandler);
router.delete('/unlink-student/:relationId', unlinkStudent);
router.get('/students_data', getStudentsHandler);

module.exports = router;