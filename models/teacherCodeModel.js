const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const createTeacherCode = async (teacherId, code) => {
    try{
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
        const codeData = {
            teacher_id: teacherId, // ✅ Campo correto (teacher_id)
            code,
            expires_at: admin.firestore.Timestamp.fromDate(expiresAt), // ✅ Campo correto (expires_at)
            used_by: null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
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
        const snapshot = await db.collection('teacher_codes')
            .where('teacher_id', '==', teacherId) // ✅ Campo correto
            .where('expires_at', '>', new Date()) // ✅ Campo correto
            .get();
            
        if(snapshot.empty) return null;
        
        const codeDoc = snapshot.docs[0];
        return codeDoc.data();
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
        
        // ✅ Verificar expiração com campo correto
        if(codeData.expires_at.toDate() < new Date()) return null;
        
        await db.collection('teacher_codes').doc(codeDoc.id).update({ 
            used_by: studentId,
            used_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return codeData;
    }catch (error){
        logger.error(`Erro ao usar código ${code}: ${error.message}`);
        throw error;
    }
};

module.exports = { createTeacherCode, getTeacherCode, useTeacherCode };