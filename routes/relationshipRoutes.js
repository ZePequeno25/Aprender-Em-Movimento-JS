/**
 * ============================================================================
 * ROTAS DE RELACIONAMENTOS PROFESSOR-ALUNO
 * ============================================================================
 * 
 * Este arquivo define todas as rotas HTTP relacionadas a vínculos professor-aluno
 * 
 * ROTAS DISPONÍVEIS:
 * 
 * POST   /api/teacher-code              - Gerar código do professor
 * GET    /api/teacher-code/:teacherId   - Buscar código do professor
 * POST   /api/link-student               - Vincular aluno via código
 * GET    /api/teacher-students/:teacherId - Listar alunos do professor
 * GET    /api/teacher-relations/:studentId - Listar professores do aluno (rota antiga)
 * GET    /api/student-relations/:studentId - Listar professores do aluno (rota nova)
 * DELETE /api/unlink-student/:relationId  - Desvincular aluno
 * 
 * CORREÇÃO FEITA:
 * Linha 15: Adicionada rota /api/student-relations/:studentId
 * 
 * MOTIVO:
 * O frontend em src/hooks/useTeacherStudent.ts (linha 134) chama:
 * await apiFetch(`/api/student-relations/${user.uid}`)
 * 
 * Mas a API só tinha a rota /api/teacher-relations/:studentId
 * 
 * SOLUÇÃO:
 * Mantivemos ambas as rotas apontando para o mesmo handler
 * - /api/teacher-relations (compatibilidade com código antigo)
 * - /api/student-relations (nova rota, nome mais claro)
 * 
 * APRENDIZADO:
 * Sempre verifique se os endpoints do frontend e backend estão sincronizados!
 */

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
router.get('/student-relations/:studentId', getStudentRelationsHandler);
router.delete('/unlink-student/:relationId', unlinkStudent);

module.exports = router;