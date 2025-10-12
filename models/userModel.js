const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const crypto = require('crypto');

const getUser = async (userId) => {
    try{
        const userDoc = await db.collection('users').doc(userId).get();
        if(!userDoc.exists) return null;
        return userDoc.data();
    }catch (error){
        logger.error(`Erro ao buscar usuario ${userId}: ${error.message}`);
        throw error;
    }
};

const isProfessor = async (userId) => {
    const user = await getUser(userId);
    return user && user.userType === 'professor';
};

const isStudent = async (userId) => {
    const user = await getUser(userId);
    return user && user.userType === 'student';
};

const getUserName = async (userId) => {
    const user = await getUser(userId);
    return user ? user.nomeCompleto : 'Usuario Desconhecido';
};

const createUser = async (userData)=>{
    try{
        const {userId, email, password, userType, nomeCompleto, cpf,dataNascimento} = userData;
        const hash = crypto.createHash('sha256').update(password).digest('hex'); // Hash the password
        const userDoc = {
            userType,
            nomeCompleto,
            cpf,
            email,
            password: hash,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            score: userType === 'aluno' ? 0 : null,
            rank: userType === 'aluno' ? 'Aluno Novo (Iniciante)' : null,
            dataNascimento: dataNascimento || null
        };
        await db.collection('users').doc(userId).set(userDoc);
        return userDoc;

    }catch (error){
        logger.error(`Erro ao criar usuario ${userId}: ${error.message}`);
        throw error;
    }
};

const verifyUserCredentials = async (email, password) => {
    try{
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if(snapshot.empty)return null;
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        if(userData.password === hash){
            return { userId: userDoc.id, ...userData };
        }
        return null;

    }catch (error){
        logger.error(`Erro ao verificar credenciais do usuario ${email}: ${error.message}`);
        throw error;
    }
};

const verifyUserPasswordReset = async (email, dataNascimento) => {
    try{
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if(snapshot.empty)return null;
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        if(userData.dataNascimento === dataNascimento){
            return { userId: userDoc.id, ...userData };
        }
        return null;

    }catch (error){
        logger.error(`Erro ao verificar usuário para redefinição: ${userId}: ${error.message}`);
        throw error;
    }
};

const resetUserPassword = async (userId, newPassword) => {
    try{
        const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
        await db.collection('users').doc(userId).update({ password: hash });

    }catch (error){
        logger.error(`Erro ao redefinir senha do usuario ${userId}: ${error.message}`);
        throw error;
    }
};

module.exports = { getUser, isProfessor, isStudent, getUserName, createUser, verifyUserCredentials, resetUserPassword, verifyUserPasswordReset };
