/**
 * ============================================================================
 * MODEL DE RELACIONAMENTOS PROFESSOR-ALUNO
 * ============================================================================
 * 
 * Este arquivo gerencia as operações do Firestore para relacionamentos
 * entre professores e alunos.
 * 
 * COLEÇÃO FIRESTORE: teacher_students
 * ID DO DOCUMENTO: formato "studentId_teacherId"
 * 
 * ESTRUTURA DO DOCUMENTO:
 * {
 *   teacher_id: string,
 *   student_id: string,
 *   teacher_name: string,
 *   student_name: string,
 *   joined_at: Timestamp
 * }
 * 
 * CORREÇÕES FEITAS:
 * - getTeacherStudents: Retorna campos específicos ao invés de spread
 * - getStudentRelations: Retorna campos específicos ao invés de spread
 * 
 * MOTIVO DAS CORREÇÕES:
 * O frontend espera propriedades específicas (teacherId, studentId, etc)
 * O spread do Firestore pode trazer snake_case (teacher_id, student_id)
 * Agora mapeamos explicitamente para garantir consistência
 */

const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { getUserName } = require('./userModel');

const createTeacherStudent = async (teacherId, studentId, studentName) => {
    try{
        const relationId = `${studentId}_${teacherId}`;
        const teacherName = await getUserName(teacherId);
        const linkData = {
            teacher_id: teacherId,
            student_id: studentId,
            teacher_name: teacherName,
            student_name: studentName,
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('teacher_students').doc(relationId).set(linkData);
        return {relationId, ...linkData};

    }catch (error){
        logger.error(`Erro ao criar Vinculação ${studentId}_${teacherId}: ${error.message}`);
        throw error;
    }
};

/**
 * FUNÇÃO: getTeacherStudents
 * 
 * OBJETIVO:
 * Buscar todos os alunos vinculados a um professor específico
 * 
 * QUERY FIRESTORE:
 * - Coleção: teacher_students
 * - Filtro: teacher_id == teacherId
 * 
 * CORREÇÃO FEITA:
 * ANTES: return snapshot.docs.map(doc => ({ relationId: doc.id, ...doc.data() }))
 * DEPOIS: return snapshot.docs.map(doc => ({ relationId: doc.id, teacherId: ..., studentId: ... }))
 * 
 * MOTIVO:
 * O spread ...doc.data() retorna teacher_id e student_id (snake_case)
 * Mas o frontend espera teacherId e studentId (camelCase)
 * 
 * Agora mapeamos explicitamente cada campo:
 * - teacher_id -> teacherId
 * - student_id -> studentId
 * - teacher_name -> teacherName
 * - student_name -> studentName
 * 
 * RETORNO:
 * Array de objetos com estrutura:
 * [{
 *   relationId: "studentId_teacherId",
 *   teacherId: "string",
 *   studentId: "string",
 *   teacherName: "string",
 *   studentName: "string",
 *   createdAt: "ISO date string"
 * }]
 */
const getTeacherStudents = async (teacherId) => {
    try{
        const snapshot = await db.collection('teacher_students')
            .where('teacher_id', '==', teacherId)
            .get();
        return snapshot.docs.map(doc => ({
            relationId: doc.id,
            teacherId: doc.data().teacher_id,
            studentId: doc.data().student_id,
            teacherName: doc.data().teacher_name,
            studentName: doc.data().student_name,
            createdAt: doc.data().joined_at ? doc.data().joined_at.toDate().toISOString(): null
        }));
        
    }catch (error){
        logger.error(`Erro ao listar alunos do professor ${teacherId}: ${error.message}`);
        throw error;
    }
};

/**
 * FUNÇÃO: getStudentRelations
 * 
 * OBJETIVO:
 * Buscar todos os professores vinculados a um aluno específico
 * 
 * QUERY FIRESTORE:
 * - Coleção: teacher_students
 * - Filtro: student_id == studentId
 * 
 * CORREÇÃO FEITA:
 * Mesma correção de getTeacherStudents
 * Mapeamento explícito snake_case -> camelCase
 * 
 * USADO EM:
 * - Frontend: src/hooks/useTeacherStudent.ts (linha 133)
 * - Endpoint: GET /api/student-relations/:studentId
 * 
 * RETORNO:
 * Array de objetos com estrutura idêntica a getTeacherStudents
 */
const getStudentRelations = async (studentId) => {
    try{
        const snapshot = await db.collection('teacher_students')
            .where('student_id', '==', studentId)
            .get();
        return snapshot.docs.map(doc => ({
            relationId: doc.id,
            teacherId: doc.data().teacher_id,
            studentId: doc.data().student_id,
            teacherName: doc.data().teacher_name,
            studentName: doc.data().student_name,
            createdAt: doc.data().joined_at ? doc.data().joined_at.toDate().toISOString(): null
        }));

    }catch (error){
        logger.error(`Erro ao listar professores do aluno ${studentId}: ${error.message}`);
        throw error;
    }
};

const deleteTeacherStudent = async (relationId) => {
    try{
        await db.collection('teacher_students').doc(relationId).delete();
    }catch (error){
        logger.error(`Erro ao deletar vinculação ${relationId}: ${error.message}`);
        throw error;
    }
};

module.exports = { createTeacherStudent, getTeacherStudents, getStudentRelations, deleteTeacherStudent };