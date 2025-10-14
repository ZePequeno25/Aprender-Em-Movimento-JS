const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { createUser, verifyUserCredential} = require('../models/userModel');
const { collection, query, where, getDocs } = require('firebase-admin/firestore');

const SALT_ROUNDS = 10;

const register = async (req, res) => {
    logger.logRequest(req, 'AUTH');
    try{
        const { nomeCompleto, cpf, userType, dataNascimento } = req.body;

        logger.debug('Dados recebidos para registro:','AUTH', { 
            nomeCompleto, 
            cpf: cpf ? cpf.substring(0, 3) + '***' : 'Não fornecido', 
            userType, 
            dataNascimento
        });

        if(!nomeCompleto || !cpf || !userType){
            logger.warn('Campos obrigatórios ausentes', 'AUTH', {
                nomeCompleto: !!nomeCompleto,
                cpf: !!cpf,
                userType: !!userType
            });
            return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
        }
        if(!/^\d{11}S/.test(cpf)){
            logger.warn('CPF inválido', 'AUTH', { 
                cpf: cpf.substring(0, 3) + '***' 
            });
            return res.status(400).json({ error: 'Formato do cpf invalido' });
        }

        const password = cpf;
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const hashKey = passwordHash.replace(/[â-zA-Z0-9]/g, '').substring(0, 16);
        const email =  `${cpf}_${userType}_${hashKey}@saberemmovimento.com`;

        logger.debug('Email gerado para o usuário', 'AUTH', { email });
        const userRecord = await admin.auth().createUser({
            email,
            password
        });

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
        logger.logAuth('Registro', userRecord.uid, true, {  
            email,
            userType
        });
        res.status(201).json({ userId: userRecord.uid, email, message: 'Usuário registrado com sucesso' });
    
    }catch(error){
        logger.logError(error, 'AUTH');
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) =>{
    logger.logRequest(req, 'AUTH');
    logger.debug('Corpo recebido', 'AUTH',{
        body: req.body
    });

    try{
        if(!db){
            logger.error('Firestore não inicializado', 'AUTH');
            throw new Error('Firestore não inicializado');
        }

        let { email, password, cpf, userType } = req.body;

        if(cpf && userType && !email){
            if(!/^\d{11}S/.test(cpf)){
                logger.warn('Cpf inválido', 'AUTH', {
                    cpf: cpf.substring(0, 3) + '***'
                })
                return res.status(400).json({ error: 'Formato do cpf invalido' });
            }
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('cpf', '==', cpf), where('userType', '==', userType));
            const snapshot = await getDocs(q);

            if(snapshot.empty){
                logger.warn('Usuário não encontrado para o cpf e Tipo de usuario fornecidos', 'AUTH', {
                    cpf: cpf.substring(0, 3) + '***',
                    userType
                });
                return res.status(401).json({ error: 'Usuario Não encontrado' });
            }
            email = snapshot.docs[0].data().email;
            logger.debug('Email recuperado do banco de dados', 'AUTH', { email });
        }

        if(!email || !password){
            logger.warn('Campos obrigatórios ausentes', 'AUTH', {
                email: !!email,
                password: !!password
            });
            return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
        }

        const user = await verifyUserCredential(email, password);

        if(!user){
            logger.warn('Credenciais inválidas', 'AUTH', { 
                email
            });
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = await admin.auth().createCustomToken(user.userId);
        logger.logAuth('Login', user.userId, true, { 
            email,
            userType: user.userType
        });
        res.status(200).json({
            userId: user.userId,
            token,
            userType: user.userType,
            nomeCompleto: user.nomeCompleto,
            email
        });
        
    }catch(error){
        logger.logError(error, 'AUTH');
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    register,
    login
};