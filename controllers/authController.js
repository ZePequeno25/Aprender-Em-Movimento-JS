const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { createUser, verifyUserCredentials, verifyUserPasswordReset, resetUserPassword } = require('../models/userModel');
const { collection, query, where, getDocs } = require('firebase-admin/firestore');


const getCurrentUserId = async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Authentication token unavailable');
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
};

const register = async (req, res) => {
    logger.logRequest(req, '[AUTH] Tentativa de registro');

    try{
        const { nomeCompleto, cpf, userType, dataNascimento} = req.body;

        logger.debug('[AUTH] Dados recebidos para registro', { 
            nomeCompleto, 
            cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
            userType,
            dataNascimento 
        });

        if(!nomeCompleto || !cpf || !userType){
            logger.warn('[AUTH] Campos obrigatórios faltando', { nomeCompleto: !!nomeCompleto, cpf: !!cpf, userType: !!userType });
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if(!/^\d{11}$/.test(cpf)){
            logger.warn('[AUTH] CPF em formato inválido', { cpf: cpf.substring(0, 3) + '***' });
            return res.status(400).json({ error: 'Invalid CPF format' });
        }
        
        const password = cpf; // senha inicial igual ao cpf
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const email = `${cpf}_${userType}_${timestamp}@aprenderemmovimento.com`;

        logger.debug('[AUTH] Criando usuário no Firebase Auth', { email });
        const userRecord = await admin.auth().createUser({email, password});

        const userData = {
            userId: userRecord.uid,
            email,
            password: passwordHash,
            userType,
            nomeCompleto,
            cpf,
            dataNascimento
        };

        await createUser(userData);
        logger.logAuth('REGISTRO', userRecord.uid, true, { email, userType });
        res.status(201).json({ userId: userRecord.uid, email, message: 'Usuário registrado com sucesso' });

    }catch (error){
        logger.logError(error, '[AUTH] Registro');
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) => {
    logger.logRequest(req, '[AUTH] Tentativa de login');
    logger.debug('[AUTH] Body recebido:', { body: req.body });
    logger.debug('[AUTH] Firestore db instance:', !!db);

    try{
        if (!db) {
            logger.error('[AUTH] Firestore db não inicializado');
            throw new Error('Firestore não inicializado');
        }

        let { email, password, cpf, userType } = req.body;

        if (cpf && userType && !email) {
            if (!/^\d{11}$/.test(cpf)) {
                logger.warn('[AUTH] CPF em formato inválido', { cpf: cpf.substring(0, 3) + '***' });
                return res.status(400).json({ error: 'Invalid CPF format' });
            }
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('cpf', '==', cpf), where('userType', '==', userType));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                logger.warn('[AUTH] Usuário não encontrado para CPF e userType', { cpf: cpf.substring(0, 3) + '***', userType });
                return res.status(401).json({ error: 'Usuário não encontrado' });
            }
            email = snapshot.docs[0].data().email;
            logger.debug('[AUTH] Email recuperado para CPF', { email, cpf: cpf.substring(0, 3) + '***' });
        }

        if(!email || !password){
            logger.warn('[AUTH] Campos obrigatórios faltando', { email: !!email, password: !!password });
            return res.status(400).json({ error: 'E-mail ou senha ausentes' });
        }
        const user = await verifyUserCredentials(email, password);
        if(!user){
            logger.warn('[AUTH] Credenciais inválidas', { email });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = await admin.auth().createCustomToken(user.userId);
        logger.logAuth('LOGIN', user.userId, true, { email, userType: user.userType });
        res.status(200).json({ userId: user.userId, token, userType: user.userType, nomeCompleto: user.nomeCompleto, email });

    }catch (error){
        logger.error(`Erro ao fazer login: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const verifyUserForPasswordResetHandler = async (req, res) => {
    try{
        const { email, dataNascimento } = req.body;
        if(!email || !dataNascimento){
            logger.warn('Campos obrigatórios faltando', { email: !!email, dataNascimento: !!dataNascimento });
            return res.status(400).json({ error: 'Falta e-mail ou data do Nascimento' });
        }
        const user = await verifyUserPasswordReset(email, dataNascimento);
        if(!user){
            logger.warn('E-mail ou data de Nascimento inválidos', { email });
            return res.status(401).json({ error: 'E-mail ou data de Nascimento inválidos' });
        }
        logger.info(`Usuário verificado para redefinição de senha: ${user.userId}`);
        res.status(200).json({ userId: user.userId, message: 'Usuário verificado para redefinição de senha' });

    }catch (error){
        logger.error(`Erro ao verificar usuário para redefinição de senha: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const resetPassword = async (req, res) => {
    try{
        const { userId, newPassword } = req.body;
        if(!userId || !newPassword){
            logger.warn('UserId ou newPassword ausentes', { userId: !!userId, newPassword: !!newPassword });
            return res.status(400).json({ error: 'UserId ou newPassword ausentes' });
        }
        await resetUserPassword(userId, newPassword);
        await admin.auth().updateUser(userId, { password: newPassword });
        logger.info(`Senha redefinida para usuário: ${userId}`);
        res.status(200).json({ message: 'Senha redefinida com sucesso' });

    }catch (error){
        logger.error(`Erro ao redefinir senha: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const verifyUser = async (req, res) => {
    try{
        const userId = await getCurrentUserId(req);
        const user = await require('../models/userModel').getUser(userId);
        if(!user){
            logger.warn('Usuário não encontrado', { userId });
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        logger.info(`Usuário verificado: ${userId}`);
        res.status(200).json({ userId, userType: user.userType, nomeCompleto: user.nomeCompleto });

    }catch (error){
        logger.error(`Erro ao verificar usuário: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { register, login, verifyUserForPasswordResetHandler, resetPassword, verifyUser };