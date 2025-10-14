const express = require('express');
const router = express.Router();
const {generateTeacherCode,
    getTeacherCodeHandler,
    linkStudentByCode,
    getTeacherStudentsHandler,
    getStudentRelationsHandler,
    unlinkStudent} = require('../controllers/relationshipController');

router.post('/teacher-code', generateTeacherCode);
router.get('/teacher-code/:teacherId', getTeacherCodeHandler);
router.post('/link-student', linkStudentByCode);
router.get('/teacher-students/:teacherId', getTeacherStudentsHandler);
router.get('/teacher-relations/:studentId', getStudentRelationsHandler);
router.delete('/unlink-student/:relationId', unlinkStudent);

module.exports = router;