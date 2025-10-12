const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const createTeacherCode = async (teacherId, code) => {
    try{
        const expiresAt = new Date(Date.now() + 24 *60 *60 *1000); // 24 horas
        const codeData = {
            teacherId: teacherId,
            code,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            used_by: null
        };
        await db.collection('teacher_codes').doc(code).set(codeData);
        return codeData;

    }catch (error){
        logger.error(`Erro ao criar código para professor ${teacherId}: ${error.message}`);
        throw error;
    }
};

const getTeacherCode = async (teacherId) => {
    try{
        const codeDoc = await db.collection('teacher_codes').doc(teacherId).get();
        if(!codeDoc.exists)return null;
        const codeData = codeDoc.data();
        if(codeData.expires_at.toDate() > new Date()){
            return codeData;
        }
        return null;
    }catch (error){
        logger.error(`Erro ao buscar código do professor ${teacherId}: ${error.message}`);
        throw error;
    }
};

const useTeacherCode = async (code, studentId) => {
    try{
        const snapshot = await db.collection('teacher_codes')
            .where('code', '==', code)
            .where('used_by', '==', null)
            .get();
        if(snapshot.empty) return null;
        const codeDoc = snapshot.docs[0];
        const codeData = codeDoc.data();
        if(codeData.expires_at.toDate() < new Date()) return null;
        await db.collection('teacher_codes').doc(codeDoc.id).update({ used_by: studentId });
    }catch (error){
        logger.error(`Erro ao usar código ${code}: ${error.message}`);
        throw error;
    }
};

module.exports = { createTeacherCode, getTeacherCode, useTeacherCode };