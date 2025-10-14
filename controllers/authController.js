const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials, verifyUserPasswordReset, resetUserPassword } = require('../models/userModel');

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
        
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '');
        const email = `${cpf}_${userType}_${timestamp}@aprenderemmovimento.com`;
        const password = cpf; // senha inicial igual ao cpf
        
        logger.debug('[AUTH] Criando usuário no Firebase Auth', { email });
        const userRecord = await admin.auth().createUser({email, password});
        
        const userData = {
            userId: userRecord.uid,
            email,
            password,
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
    
    try{
        const { email, password } = req.body;
        
        logger.debug('[AUTH] Credenciais recebidas', { 
            email: email ? email.substring(0, 10) + '...' : 'não fornecido',
            hasPassword: !!password 
        });
        
        if(!email || !password){
            logger.warn('[AUTH] Email ou senha faltando', { email: !!email, password: !!password });
            return res.status(400).json({ error: 'Missing email or password' });
        }
        
        logger.debug('[AUTH] Verificando credenciais no banco');
        const user = await verifyUserCredentials(email, password);
        
        if(!user){
            logger.warn('[AUTH] Credenciais inválidas', { email: email.substring(0, 10) + '...' });
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        logger.debug('[AUTH] Gerando token customizado', { userId: user.userId });
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