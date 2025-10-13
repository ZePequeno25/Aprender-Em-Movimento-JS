/**
 * ============================================================================
 * CONTROLLER DE RELACIONAMENTOS PROFESSOR-ALUNO
 * ============================================================================
 * 
 * Este arquivo gerencia toda a lógica de vinculação entre professores e alunos.
 * 
 * FUNCIONALIDADES PRINCIPAIS:
 * 1. Geração de códigos únicos para professores
 * 2. Vinculação de alunos aos professores via código
 * 3. Listagem de relacionamentos (alunos de um professor / professores de um aluno)
 * 4. Desvinculação de relacionamentos
 * 
 * CORREÇÕES FEITAS:
 * - Corrigido typo: req.autorization -> req.headers.authorization (linha 17)
 * - Adicionado validação de dados no generateTeacherCode (linhas 30-33)
 * - Corrigido uso do db no linkStudentByCode (linha 73)
 * - Removido wrapper desnecessário { relations } nas respostas (linhas 111, 127)
 * - Adicionado importação do db no unlinkStudent (linha 145)
 */

const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');

const {isProfessor, isStudent, getUserName} = require('../models/userModel');
const {createTeacherCode, getTeacherCode, useTeacherCode} = require('../models/teacherCodeModel');
const {createTeacherStudent, getTeacherStudents, getStudentRelations, deleteTeacherStudent} = require('../models/teacherStudentModel');

/**
 * FUNÇÃO AUXILIAR: Validação de IDs
 * 
 * OBJETIVO:
 * Verificar se um ID é válido antes de usar em queries do banco
 * 
 * VALIDAÇÕES:
 * - ID não pode ser null/undefined
 * - ID não pode ser a string "undefined"
 * - ID deve ser uma string
 * - ID não pode estar vazio após trim
 * 
 * @param {string} id - ID a ser validado
 * @param {string} paramName - Nome do parâmetro (para log)
 * @returns {boolean} true se válido, false se inválido
 */
const isValidId = (id, paramName) => {
    if(!id || id === 'undefined' || typeof id !== 'string' || id.trim().length === 0){
        logger.warn(`ID inválido para ${paramName}: ${id}`);
        return false;
    }
    return true;
};

/**
 * FUNÇÃO AUXILIAR: Extrair ID do usuário autenticado
 * 
 * OBJETIVO:
 * Validar o token JWT e extrair o UID do usuário autenticado
 * 
 * FLUXO:
 * 1. Extrai token do header Authorization
 * 2. Remove o prefixo "Bearer " do token
 * 3. Verifica validade do token com Firebase Admin
 * 4. Retorna o UID do usuário
 * 
 * CORREÇÃO FEITA:
 * Linha 17: req.autorization -> req.headers.authorization (typo corrigido!)
 * 
 * @param {Object} req - Request object do Express
 * @returns {Promise<string>} UID do usuário autenticado
 * @throws {Error} Se token não for encontrado ou for inválido
 */
const getCurrentUserId = async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if(!token) throw new Error('Authentication token unavailable');
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

/**
 * ENDPOINT: POST /api/teacher-code
 * 
 * OBJETIVO:
 * Gerar e salvar um código único para o professor se vincular aos alunos
 * 
 * BODY ESPERADO:
 * {
 *   "teacherId": "string",    // UID do professor (deve ser igual ao token)
 *   "linkCode": "string"      // Código gerado (ex: "PROF_ABC12345")
 * }
 * 
 * VALIDAÇÕES:
 * 1. Token JWT válido
 * 2. Usuário deve ser professor (userType: 'professor')
 * 3. teacherId e linkCode devem estar presentes
 * 4. teacherId deve ser igual ao userId do token (segurança)
 * 
 * CORREÇÕES FEITAS:
 * - Adicionadas validações de teacherId e linkCode (linhas 30-33)
 * - Validação que teacherId === userId para segurança
 * - Mensagem de erro mais clara
 * 
 * RESPOSTA:
 * Status 200: { linkCode: "string", message: "Success" }
 * Status 403: { error: "Only professors can generate codes" }
 * Status 400: { error: "Invalid teacherId or linkCode" }
 */
const generateTeacherCode = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        if(!await isProfessor(userId)){
            return res.status(403).json({error: 'Only professors can generate codes'});
        }
        const { teacherId, linkCode } = req.body;
        if(!teacherId || !linkCode || teacherId !== userId){
            return res.status(400).json({error: 'Invalid teacherId or linkCode'});
        }
        await createTeacherCode(teacherId, linkCode);
        logger.info(`Código gerado: ${linkCode} para professor: ${userId}`);
        res.status(200).json({ linkCode, message: 'Teacher code generated successfully' });
    }catch (error){
        logger.error(`Erro ao gerar código: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * ENDPOINT: GET /api/teacher-code/:teacherId
 * 
 * OBJETIVO:
 * Buscar o código de vinculação de um professor específico
 * 
 * PARÂMETROS URL:
 * - teacherId: UID do professor
 * 
 * VALIDAÇÕES:
 * - teacherId deve ser válido (não vazio, não undefined)
 * 
 * CORREÇÃO FEITA:
 * - Removida autenticação obrigatória (linha 47 do código antigo)
 * - Agora qualquer um pode buscar o código para se vincular
 * - Retorna null se código não existir (ao invés de gerar um novo)
 * 
 * RESPOSTA:
 * Status 200: { code: "PROF_ABC12345" } ou { code: null }
 * Status 400: { error: "Invalid teacherId" }
 */
const getTeacherCodeHandler = async (req, res) =>{
    try{
        const { teacherId } = req.params;
        if(!isValidId(teacherId, 'teacherId')){
            return res.status(400).json({ error: 'Invalid teacherId' });
        }
        const codeData = await getTeacherCode(teacherId);
        const code = codeData ? codeData.code : null;
        res.status(200).json({ code });

    }catch (error){
        logger.error(`Erro ao carregar código: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * ENDPOINT: POST /api/link-student
 * 
 * OBJETIVO:
 * Vincular um aluno a um professor usando o código de vinculação
 * 
 * BODY ESPERADO:
 * {
 *   "teacherCode": "string",   // Código do professor (ex: "PROF_ABC12345")
 *   "studentId": "string",     // UID do aluno (deve ser igual ao token)
 *   "studentName": "string"    // Nome completo do aluno
 * }
 * 
 * FLUXO:
 * 1. Valida token e verifica se usuário é aluno
 * 2. Valida dados recebidos (teacherCode, studentId, studentName)
 * 3. Busca código no Firestore (collection 'teacher_codes')
 * 4. Verifica se código existe e é válido
 * 5. Extrai teacherId do código
 * 6. Verifica se vinculação já existe
 * 7. Cria nova vinculação em 'teacher_students'
 * 8. Retorna sucesso com nome do professor
 * 
 * CORREÇÕES FEITAS:
 * - Linha 73: Importação local do db para acessar Firestore
 * - Busca direta do código ao invés de usar useTeacherCode
 * - Validação se vinculação já existe (evita duplicatas)
 * 
 * RESPOSTA:
 * Status 200: { success: true, teacherName: "string", relationId: "string" }
 * Status 403: { error: "Only students can link to teachers" }
 * Status 400: { error: "Invalid or expired code" / "Already linked" }
 */
const linkStudentByCode = async (req, res) =>{
    try{
        const userId = await getCurrentUserId(req);
        if(!await isStudent(userId)){
            return res.status(403).json({ error: 'Only students can link to teachers' });
        }
        const{teacherCode, studentId, studentName} = req.body;
        if(!teacherCode || studentId !== userId || !isValidId(studentId, 'studentId')){
            return res.status(400).json({ error: 'Invalid teacherCode or studentId' });
        }
        
        const { db } = require('../utils/firebase');
        const snapshot = await db.collection('teacher_codes')
            .where('code', '==', teacherCode)
            .get();
        
        if(snapshot.empty){
            return res.status(400).json({ error: 'Invalid or expired code' });
        }
        
        const codeDoc = snapshot.docs[0];
        const codeData = codeDoc.data();
        const teacherId = codeData.teacherId;
        const relationId = `${studentId}_${teacherId}`;
        const existing = await db.collection('teacher_students').doc(relationId).get();
        if(existing.exists){
            return res.status(400).json({ error: 'You are already linked to this teacher' });
        }
        const linkData = await createTeacherStudent(teacherId, studentId, studentName);
        logger.info(`Vinculação via código: aluno ${userId} ao professor ${teacherId}`);
        res.status(200).json({ success: true, teacherName: linkData.teacher_name, relationId});

    }catch (error){
        logger.error(`Erro ao vincular aluno: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * ENDPOINT: GET /api/teacher-students/:teacherId
 * 
 * OBJETIVO:
 * Listar todos os alunos vinculados a um professor específico
 * 
 * PARÂMETROS URL:
 * - teacherId: UID do professor
 * 
 * CORREÇÃO FEITA:
 * - Linha 111: Removido wrapper { relations }
 * - ANTES: res.json({ relations: [...] })
 * - DEPOIS: res.json([...])
 * - MOTIVO: Frontend espera array diretamente, não objeto com propriedade
 * 
 * RESPOSTA:
 * Status 200: [
 *   {
 *     relationId: "studentId_teacherId",
 *     teacherId: "string",
 *     studentId: "string", 
 *     teacherName: "string",
 *     studentName: "string",
 *     createdAt: "ISO string"
 *   },
 *   ...
 * ]
 */
const getTeacherStudentsHandler = async (req, res) =>{
    try{
        const {teacherId} = req.params;
        if(!isValidId(teacherId, 'teacherId')){
            return res.status(400).json({ error: 'Invalid teacherId' });
        }
        const relations = await getTeacherStudents(teacherId);
        res.status(200).json(relations);

    }catch (error){
        logger.error(`Erro ao listar alunos: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * ENDPOINT: GET /api/student-relations/:studentId (também /api/teacher-relations/:studentId)
 * 
 * OBJETIVO:
 * Listar todos os professores vinculados a um aluno específico
 * 
 * PARÂMETROS URL:
 * - studentId: UID do aluno
 * 
 * CORREÇÕES FEITAS:
 * - Linha 127: Removido wrapper { relations }
 * - Removida validação de autenticação (linhas 109-112 do código antigo)
 * - MOTIVO: Mesma razão do endpoint anterior
 * 
 * OBSERVAÇÃO:
 * Este endpoint está registrado em duas rotas (ver relationshipRoutes.js linha 15):
 * - /api/student-relations/:studentId (nova)
 * - /api/teacher-relations/:studentId (mantida por compatibilidade)
 * 
 * RESPOSTA:
 * Status 200: [
 *   {
 *     relationId: "studentId_teacherId",
 *     teacherId: "string",
 *     studentId: "string",
 *     teacherName: "string", 
 *     studentName: "string",
 *     createdAt: "ISO string"
 *   },
 *   ...
 * ]
 */
const getStudentRelationsHandler = async (req, res) => {
    try{
        const {studentId} = req.params;
        if(!isValidId(studentId, 'studentId')){
            return res.status(400).json({ error: 'Invalid studentId' });
        }
        const relations = await getStudentRelations(studentId);
        res.status(200).json(relations);

    }catch (error){
        logger.error(`Erro ao listar professores: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * ENDPOINT: DELETE /api/unlink-student/:relationId
 * 
 * OBJETIVO:
 * Desvincular um aluno de um professor (deletar relacionamento)
 * 
 * PARÂMETROS URL:
 * - relationId: ID da relação no formato "studentId_teacherId"
 * 
 * VALIDAÇÕES:
 * 1. relationId deve ser válido
 * 2. Token JWT válido
 * 3. Relação deve existir no banco
 * 4. Usuário deve ser participante (professor OU aluno da relação)
 * 
 * CORREÇÃO FEITA:
 * - Linha 145: Importação local do db para acessar Firestore
 * - ANTES: db estava indefinido
 * - DEPOIS: const { db } = require('../utils/firebase')
 * 
 * SEGURANÇA:
 * Apenas o professor ou aluno envolvido pode desvincular
 * Outros usuários receberão erro 403
 * 
 * RESPOSTA:
 * Status 200: { success: true, message: "Unlinked successfully" }
 * Status 403: { error: "Only participants can unlink" }
 * Status 404: { error: "Relation not found" }
 */
const unlinkStudent = async (req, res) => {
    try{
        const {relationId} = req.params;
        if(!isValidId(relationId, 'relationId')){
            return res.status(400).json({ error: 'Invalid relationId' });
        }
        const userId = await getCurrentUserId(req);
        const { db } = require('../utils/firebase');
        const relationDoc = await db.collection('teacher_students').doc(relationId).get();
        if(!relationDoc.exists){
            return res.status(404).json({ error: 'Relation not found' });
        }
        const relationData = relationDoc.data();
        if(relationData.teacher_id !== userId && relationData.student_id !== userId){
            return res.status(403).json({ error: 'Only participants can unlink' });
        }
        await deleteTeacherStudent(relationId);
        logger.info(`Relação desvinculada: ${relationId} por ${userId}`);
        res.status(200).json({ success: true, message: 'Unlinked successfully' });

    }catch (error){
        logger.error(`Erro ao desvincular: ${error.message}`);
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
