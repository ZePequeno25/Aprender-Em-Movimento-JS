const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');

const {isProfessor, isStudent, getUserName} = require('../models/userModel');
const {createTeacherCode, getTeacherCode, useTeacherCode} = require('../models/teacherCodeModel');
const {createTeacherStudent, getTeacherStudents, getStudentRelations, deleteTeacherStudent} = require('../models/teacherStudentModel');

const isValidId = (id, paramName) => {
    if(!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0){
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

const getCurrentUserId = async (req) => {
    const token = req.headers.autorization?.replace('Bearer ', '');
    if(!token) throw new Error('Authentication token unavailable');
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

const generateTeacherCode = async (req, res) => {
    logger.info('🔑 [relationshipController] Iniciando geração de código de professor', 'RELATIONSHIPS');
    
    try{
        const userId = await getCurrentUserId(req);
        logger.info(`👤 [relationshipController] Usuário autenticado: ${userId}`, 'RELATIONSHIPS');
        
        if(!await isProfessor(userId)){
            logger.warn(`❌ [relationshipController] Usuário ${userId} não é professor`, 'RELATIONSHIPS');
            return res.status(403).json({error: 'Only teachers can generate codes'});
        }
        
        const linkCode = `PROF_${userId.slice(0, 8).toUpperCase()}`;
        await createTeacherCode(userId, linkCode);
        logger.info(`✅ [relationshipController] Código gerado: ${linkCode}`, 'RELATIONSHIPS');
        res.status(200).json({ linkCode, message: 'Teacher code generated successfully' });
        
    }catch (error){
        logger.error(`Erro ao gerar código`, error, 'RELATIONSHIPS');
        res.status(500).json({ error: error.message });
    }
};

const getTeacherCodeHandler = async (req, res) =>{
    logger.info('📋 [relationshipController] Buscando código do professor', 'RELATIONSHIPS');
    
    try{
        const { teacherId } = req.params;
        logger.info(`📊 [relationshipController] teacherId: ${teacherId}`, 'RELATIONSHIPS');
        
        if(!isValidId(teacherId, 'teacherId')){
            logger.warn(`❌ [relationshipController] teacherId inválido`, 'RELATIONSHIPS');
            return res.status(400).json({ error: 'Invalid teacherId' });
        }
        const userId = await getCurrentUserId(req);
        if(userId !== teacherId || !await isProfessor(userId)){
            logger.warn(`❌ [relationshipController] Acesso negado para ${userId}`, 'RELATIONSHIPS');
            return res.status(403).json({ error: 'Access denied' });
        }
        const codeData = await getTeacherCode(teacherId);
        const linkCode = codeData ? codeData.code : `PROF_${userId.slice(0, 8).toUpperCase()}`;
        logger.info(`✅ [relationshipController] Código encontrado: ${linkCode}`, 'RELATIONSHIPS');
        res.status(200).json({ linkCode });

    }catch (error){
        logger.error(`Erro ao carregar código`, error, 'RELATIONSHIPS');
        res.status(500).json({ error: error.message });
    }
};

const linkStudentByCode = async (req, res) =>{
    logger.info('🔗 [relationshipController] Iniciando vinculação de aluno', 'RELATIONSHIPS');
    
    try{
        const userId = await getCurrentUserId(req);
        logger.info(`👤 [relationshipController] Usuário autenticado: ${userId}`, 'RELATIONSHIPS');
        
        if(!await isStudent(userId)){
            logger.warn(`❌ [relationshipController] Usuário ${userId} não é aluno`, 'RELATIONSHIPS');
            return res.status(403).json({ error: 'Only students can link to teachers' });
        }
        const{teacherCode, studentId, studentName} = req.body;
        logger.info(`📊 [relationshipController] Dados: code=${teacherCode}, studentName=${studentName}`, 'RELATIONSHIPS');
        
        if(!teacherCode || studentId !== userId || !isValidId(studentId, 'studentId')){
            logger.warn(`❌ [relationshipController] Dados inválidos`, 'RELATIONSHIPS');
            return res.status(400).json({ error: 'Invalid teacherCode or studentId' });
        }
        const codeData = await useTeacherCode(teacherCode, userId);
        if(!codeData){
            logger.warn(`❌ [relationshipController] Código inválido ou expirado: ${teacherCode}`, 'RELATIONSHIPS');
            return res.status(400).json({ error: 'Invalid or expired code' });
        }
        const teacherId = codeData.teacher_id;
        const relationId = `${studentId}_${teacherId}`;
        const existing = await db.collection('teacher_students').doc(relationId).get();
        if(existing.exists){
            logger.warn(`❌ [relationshipController] Relação já existe: ${relationId}`, 'RELATIONSHIPS');
            return res.status(400).json({ error: 'You are already linked to this teacher' });
        }
        const linkData = await createTeacherStudent(teacherId, studentId, studentName);
        logger.info(`✅ [relationshipController] Aluno ${userId} vinculado ao professor ${teacherId}`, 'RELATIONSHIPS');
        res.status(200).json({ success: true, teacherName: linkData.teacher_name, relationId});

    }catch (error){
        logger.error(`Erro ao vincular aluno`, error, 'RELATIONSHIPS');
        res.status(500).json({ error: error.message });
    }
};

const getTeacherStudentsHandler = async (req, res) =>{
    try{
        const {teacherId} = req.params;
        if(!isValidId(teacherId, 'teacherId')){
            return res.status(400).json({ error: 'Invalid teacherId' });
        }
        const relations = await getTeacherStudents(teacherId);
        res.status(200).json({ relations });

    }catch (error){
        logger.error(`Erro ao listar alunos: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const getStudentRelationsHandler = async (req, res) => {
    try{
        const {studentId} = req.params;
        if(!isValidId(studentId, 'studentId')){
            return res.status(400).json({ error: 'Invalid studentId' });
        }
        const userId = await getCurrentUserId(req);
        if(userId !== studentId || !await isStudent(userId)){
            return res.status(403).json({ error: 'Access denied' });
        }
        const relations = await getStudentRelations(studentId);
        res.status(200).json({ relations });

    }catch (error){
        logger.error(`Erro ao listar professores: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const unlinkStudent = async (req, res) => {
    logger.info('🔓 [relationshipController] Iniciando desvinculação', 'RELATIONSHIPS');
    
    try{
        const {relationId} = req.params;
        logger.info(`📊 [relationshipController] relationId: ${relationId}`, 'RELATIONSHIPS');
        
        if(!isValidId(relationId, 'relationId')){
            logger.warn(`❌ [relationshipController] relationId inválido`, 'RELATIONSHIPS');
            return res.status(400).json({ error: 'Invalid relationId' });
        }
        const userId = await getCurrentUserId(req);
        const relationDoc = await db.collection('teacher_students').doc(relationId).get();
        if(!relationDoc.exists){
            logger.warn(`❌ [relationshipController] Relação não encontrada: ${relationId}`, 'RELATIONSHIPS');
            return res.status(404).json({ error: 'Relation not found' });
        }
        const relationData = relationDoc.data();
        if(relationData.teacher_id !== userId && relationData.student_id !== userId){
            logger.warn(`❌ [relationshipController] Usuário ${userId} sem permissão`, 'RELATIONSHIPS');
            return res.status(403).json({ error: 'Only participants can unlink' });
        }
        await deleteTeacherStudent(relationId);
        logger.info(`✅ [relationshipController] Relação desvinculada: ${relationId}`, 'RELATIONSHIPS');
        res.status(200).json({ success: true, message: 'Unlinked successfully' });

    }catch (error){
        logger.error(`Erro ao desvincular`, error, 'RELATIONSHIPS');
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    generateTeacherCode,
    getTeacherCodeHandler,
    linkStudentByCode,
    getTeacherStudentsHandler,
    getStudentRelationsHandler,
    unlinkStudent
  };