const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials } = require('../models/userModel');
const bcrypt = require('bcrypt');
const { collection, query, where, getDocs } = require('firebase-admin/firestore');

const SALT_ROUNDS = 10;

const register = async (req, res) => {
  logger.logRequest(req, 'AUTH');
  try {
    const { nomeCompleto, cpf, userType, dataNascimento } = req.body;
    logger.debug('Dados recebidos para registro', 'AUTH', {
      nomeCompleto,
      cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
      userType,
      dataNascimento,
    });

    if (!nomeCompleto || !cpf || !userType || !dataNascimento) {
      logger.warn('Campos obrigatórios faltando', 'AUTH', { nomeCompleto: !!nomeCompleto, cpf: !!cpf, userType: !!userType, dataNascimento: !!dataNascimento });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const validUserTypes = ['aluno', 'professor'];
    if (!validUserTypes.includes(userType)) {
      logger.warn('userType inválido', 'AUTH', { userType });
      return res.status(400).json({ error: 'Formato do userType inválido' });
    }
    if (!/^\d{11}$/.test(cpf)) {
      logger.warn('CPF em formato inválido', 'AUTH', { cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido' });
      return res.status(400).json({ error: 'Formato do CPF inválido' });
    }

    const password = cpf;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const email = `${cpf}_${userType}_${hashKey}@saberemmovimento.com`;

    logger.debug('Criando usuário no Firebase Auth', 'AUTH', { email });
    const userRecord = await admin.auth().createUser({ email, password });

    const userData = {
      userId: userRecord.uid,
      email,
      password: passwordHash,
      userType,
      nomeCompleto,
      cpf,
      dataNascimento,
    };

    await createUser(userData);
    logger.logAuth('REGISTER', userRecord.uid, true, { email, userType });
    res.status(201).json({ userId: userRecord.uid, email, message: 'User registered successfully' });
  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  logger.logRequest(req, 'AUTH');
  logger.debug('Body recebido', 'AUTH', { body: req.body });

  try {
    if (!db) {
      logger.error('Firestore db não inicializado', 'AUTH');
      throw new Error('Firestore não inicializado');
    }
    if (typeof collection !== 'function') {
      logger.error('Função collection não definida', 'AUTH', { collectionType: typeof collection });
      throw new Error('Função collection não definida');
    }

    let { email, password, cpf, userType } = req.body;

    const validUserTypes = ['aluno', 'professor'];
    if (cpf && userType && !email) {
      if (!validUserTypes.includes(userType)) {
        logger.warn('userType inválido', 'AUTH', { userType });
        return res.status(400).json({ error: 'Formato do userType inválido' });
      }
      if (!/^\d{11}$/.test(cpf)) {
        logger.warn('CPF em formato inválido', 'AUTH', { cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido' });
        return res.status(400).json({ error: 'Formato do CPF inválido' });
      }
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('cpf', '==', cpf), where('userType', '==', userType));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        logger.warn('Usuário não encontrado para CPF e userType', 'AUTH', { cpf: cpf.substring(0, 3) + '***', userType });
        return res.status(401).json({ error: 'User not found' });
      }
      email = snapshot.docs[0].data().email;
      logger.debug('Email recuperado para CPF', 'AUTH', { email, cpf: cpf.substring(0, 3) + '***' });
    }

    if (!email || !password) {
      logger.warn('Campos obrigatórios faltando', 'AUTH', { email: !!email, password: !!password });
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = await verifyUserCredentials(email, password);
    if (!user) {
      logger.warn('Credenciais inválidas', 'AUTH', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await admin.auth().createCustomToken(user.userId);
    logger.logAuth('LOGIN', user.userId, true, { email, userType: user.userType });
    res.status(200).json({ userId: user.userId, token, userType: user.userType, nomeCompleto: user.nomeCompleto, email });
  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };