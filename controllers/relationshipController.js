const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const db = admin.firestore(); // FIX: Initialize Firestore db instance

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

const getStudentsHandler = async (req, res) => {
  try {
    console.log('👥 [relationshipController] Buscando dados dos alunos por Document ID...');
    
    const userId = await getCurrentUserId(req);
    console.log(`🔍 [relationshipController] Usuário autenticado (Document ID): ${userId}`);
    
    // ✅ VERIFICAR SE É PROFESSOR BUSCANDO PELO DOCUMENT ID
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ [relationshipController] Usuário não encontrado: ${userId}`);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const userData = userDoc.data();
    if (userData.userType !== 'professor') {
      console.log(`❌ [relationshipController] Usuário ${userId} não é professor`);
      return res.status(403).json({ error: 'Apenas professores podem acessar dados dos alunos' });
    }

    // Buscar alunos vinculados ao professor pelo Document ID
    const snapshot = await db.collection('teacher_students')
      .where('teacher_id', '==', userId) // ✅ Document ID do professor
      .get();
    
    console.log(`📊 [relationshipController] ${snapshot.size} relações encontradas`);
    
    const students = [];
    
    for (const doc of snapshot.docs) {
      const relationData = doc.data();
      const studentId = relationData.student_id; // ✅ Document ID do aluno
      
      try {
        // ✅ BUSCAR ALUNO PELO DOCUMENT ID
        const studentDoc = await db.collection('users').doc(studentId).get();
        
        if (studentDoc.exists) {
          const studentData = studentDoc.data();
          students.push({
            id: studentId, // ✅ Document ID do aluno
            nomeCompleto: studentData.nomeCompleto,
            email: studentData.email,
            userType: studentData.userType,
            score: studentData.score || 0,
            rank: studentData.rank || 'Iniciante',
            cpf: studentData.cpf,
            dataNascimento: studentData.dataNascimento,
            // Dados da relação
            relationId: doc.id, // ✅ Document ID da relação
            joined_at: relationData.joined_at ? relationData.joined_at.toDate().toISOString() : null,
            student_name: relationData.student_name,
            teacher_name: relationData.teacher_name
          });
        } else {
          console.warn(`⚠️ [relationshipController] Aluno não encontrado: ${studentId}`);
        }
      } catch (error) {
        console.warn(`⚠️ [relationshipController] Erro ao buscar aluno ${studentId}: ${error.message}`);
      }
    }

    console.log(`✅ [relationshipController] ${students.length} alunos retornados`);
    res.status(200).json(students);
    
  } catch (error) {
    console.error(`❌ [relationshipController] Erro ao buscar alunos: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

const getCurrentUserId = async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
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
    
    try {
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

const linkStudentByCode = async (req, res) => {
    logger.info('🔗 [relationshipController] Iniciando vinculação de aluno', 'RELATIONSHIPS');
    
    try {
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

const getTeacherStudentsHandler = async (req, res) => {
    try {
        const userId = await getCurrentUserId(req);
        console.log(`🔍 [relationshipController] Buscando alunos para teacherId: ${userId}`);
        
        if (!await isProfessor(userId)) {
        return res.status(403).json({ error: 'Only teachers can access student data' });
        }

        const relations = await getTeacherStudents(userId);
        res.status(200).json(relations || []);

    } catch (error) {
        console.error(`Erro ao listar alunos: ${error.message}`);
        res.status(error.message.includes('Token') ? 401 : 500).json({ error: error.message });
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
        res.status(200).json(relations || []);

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
    unlinkStudent,
    getStudentsHandler
  };
