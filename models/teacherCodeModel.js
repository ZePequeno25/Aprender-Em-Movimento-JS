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
        // Buscar todos os códigos do professor (não expirados)
        const snapshot = await db.collection('teacher_codes')
            .where('teacher_id', '==', teacherId)
            .get();
            
        if(snapshot.empty) return null;
        
        // Encontrar o código mais recente que não está expirado
        const now = admin.firestore.Timestamp.now();
        let latestCode = null;
        let latestDate = null;
        
        for (const doc of snapshot.docs) {
            const codeData = doc.data();
            const expiresAt = codeData.expires_at;
            
            // Verificar se não está expirado
            if (expiresAt && expiresAt.toMillis() > now.toMillis()) {
                // Se não há código selecionado ou este é mais recente
                if (!latestCode || (codeData.created_at && codeData.created_at.toMillis() > latestDate)) {
                    latestCode = codeData;
                    latestDate = codeData.created_at ? codeData.created_at.toMillis() : 0;
                }
            }
        }
        
        return latestCode;
    }catch (error){
        logger.error(`Erro ao buscar código do professor ${teacherId}: ${error.message}`);
        throw error;
    }
};

const useTeacherCode = async (code, studentId) => {
    try{
        // Buscar código pelo código (não pelo used_by, pois código pode ser reutilizado)
        const snapshot = await db.collection('teacher_codes')
            .where('code', '==', code)
            .get();
            
        if(snapshot.empty) {
            console.log(`❌ [teacherCodeModel] Código não encontrado: ${code}`);
            return null;
        }
        
        const codeDoc = snapshot.docs[0];
        const codeData = codeDoc.data();
        
        // ✅ Verificar expiração
        const now = admin.firestore.Timestamp.now();
        if (!codeData.expires_at || codeData.expires_at.toMillis() <= now.toMillis()) {
            console.log(`❌ [teacherCodeModel] Código expirado: ${code}`);
            return null;
        }
        
        // ✅ Verificar se o aluno já usou este código (para evitar duplicação)
        const existingRelation = await db.collection('teacher_students')
            .where('teacher_id', '==', codeData.teacher_id)
            .where('student_id', '==', studentId)
            .get();
        
        if (!existingRelation.empty) {
            console.log(`⚠️ [teacherCodeModel] Aluno já vinculado a este professor`);
            // Retorna o código mesmo assim, pois a relação já existe
            return codeData;
        }
        
        // Não marca como usado, pois o código pode ser reutilizado por outros alunos
        // Apenas retorna os dados do código
        return codeData;
    }catch (error){
        logger.error(`Erro ao usar código ${code}: ${error.message}`);
        throw error;
    }
};

module.exports = { createTeacherCode, getTeacherCode, useTeacherCode };