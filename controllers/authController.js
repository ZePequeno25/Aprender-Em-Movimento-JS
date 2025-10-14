const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials, verifyUserPasswordReset, resetUserPassword } = require('../models/userModel');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

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
        const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16); // parte do hash para garantir unicidade
        const email = `${cpf}_${userType}_${hashKey}@aprenderemmovimento.com`;
        
        
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
        
        logger.debug('[AUTH] Salvando usuário no banco de dados', { userId: userRecord.uid });
        await createUser(userData);
        
        logger.logAuth('REGISTRO', userRecord.uid, true, { userType, nomeCompleto });
        res.status(201).json({ message: 'User registered successfully', userId: userRecord.uid, email, password });

    }catch (error){
        logger.logError(error, 'AUTH - REGISTRO');
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) => {
    logger.logRequest(req, '[AUTH] Tentativa de login');
    logger.debug('[AUTH] Body recebido:', { body: req.body });
    
    try{
        let { email, password, cpf, userType } = req.body;
        
        // Se CPF e userType forem fornecidos, buscar email no Firestore
        if(cpf && userType && !email){
            if(!/^\d{11}$/.test(cpf)){
                logger.warn('[AUTH] CPF em formato inválido para login', { cpf: cpf.substring(0, 3) + '***' });
                return res.status(400).json({ error: 'Invalid CPF format' });
            }
            const snapshot = await db.collection('users')
                .where('cpf', '==', cpf)
                .where('userType', '==', userType)
                .get();
            if(snapshot.empty){
                logger.warn('[AUTH] Usuário não encontrado para CPF e userType', { cpf: cpf.substring(0, 3) + '***', userType });
                return res.status(401).json({ error: 'User not found' });
            }
            email = snapshot.docs[0].data().email;
            logger.debug('[AUTH] Email encontrado para login via CPF e userType', {email, cpf: cpf.substring(0, 3) + '***' });
                
        }

        if(!email || !password){
            logger.warn('[AUTH] Campos obrigatórios faltando', { email: !!email, password: !!password });
            return res.status(400).json({ error: 'Missing email or password' });
        }
        
        logger.debug('[AUTH] Verificando credenciais no banco');
        const user = await verifyUserCredentials(email, password);
        
        if(!user){
            logger.warn('[AUTH] Credenciais inválidas', { email: email.substring(0, 10) + '...' });
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const token = await admin.auth().createCustomToken(user.userId);
        logger.logAuth('LOGIN', user.userId, true, { userType: user.userType });
        res.status(200).json({ token, userId: user.userId, userType: user.userType });

    }catch (error){
        logger.logError(error, 'AUTH - LOGIN');
        res.status(500).json({ error: error.message });
    }
};

const verifyUserForPasswordResetHandler = async (req, res) => {
    try{
        const { email, dataNascimento } = req.body;
        if(!email || !dataNascimento){
            return res.status(400).json({ error: 'Missing email or dataNascimento' });
        }
        const user = await verifyUserPasswordReset(email, dataNascimento);
        if(!user){
            return res.status(401).json({ error: 'Invalid email or dataNascimento' });
        }
        logger.info(`Usuário verificado para redefinição de senha: ${user.userId}`);
        res.status(200).json({ userId: user.userId, message: 'User verified for password reset' });

    }catch (error){
        logger.error(`Erro ao verificar usuário para redefinição de senha: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

const resetPassword = async (req, res) => {
    try{
        const { userId, newPassword } = req.body;
        if(!userId || !newPassword){
            return res.status(400).json({ error: 'Missing userId or newPassword' });
        }
        await resetUserPassword(userId, newPassword);
        await admin.auth().updateUser(userId, { password: newPassword });
        logger.info(`Senha redefinida para usuário: ${userId}`);
        res.status(200).json({ message: 'Password reset successfully' });

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
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ userId, userType: user.userType, nomeCompleto: user.nomeCompleto });

    }catch (error){
        logger.error(`Erro ao verificar usuário: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { register, login, verifyUserForPasswordResetHandler, resetPassword, verifyUser };