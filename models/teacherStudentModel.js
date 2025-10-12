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

const getTeacherStudents = async (teacherId) => {
    try{
        const snapshot = await db.collection('teacher_students')
            .where('teacher_id', '==', teacherId)
            .get();
        return snapshot.docs.map(doc => ({
            relationId: doc.id,
            ...doc.data(),
            createdAt: doc.data().joined_at ? doc.data().joined_at.toDate().toISOString(): null
        }));
        
    }catch (error){
        logger.error(`Erro ao listar alunos do professor ${teacherId}: ${error.message}`);
        throw error;
    }
};

const getStudentRelations = async (studentId) => {
    try{
        const snapshot = await db.collection('teacher_students')
            .where('student_id', '==', studentId)
            .get();
        return snapshot.docs.map(doc => ({
            relationId: doc.id,
            ...doc.data(),
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