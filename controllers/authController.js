const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials } = require('../models/userModel');
const bcrypt = require('bcrypt');

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
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
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
    res.status(201).json({ userId: userRecord.uid, email, message: 'Usuário registrado com sucesso' });
  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  logger.logRequest(req, 'AUTH');
  
  try {
    const { cpf, password, userType } = req.body;

    // DEBUG DIRETO - Vamos recriar o processo do registro
    console.log('=== DEBUG INICIO ===');
    console.log('CPF:', cpf);
    console.log('Password:', password);
    console.log('UserType:', userType);

    // 1. Gerar o hash EXATAMENTE como no registro
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log('Hash gerado no LOGIN:', passwordHash);
    
    const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    console.log('HashKey no LOGIN:', hashKey);
    
    const email = `${cpf}_${userType}_${hashKey}@saberemmovimento.com`;
    console.log('Email gerado no LOGIN:', email);

    // 2. Buscar TODOS os usuários com este CPF para ver o que existe
    const usersWithCPF = await db.collection('users')
      .where('cpf', '==', cpf)
      .get();

    console.log('Usuários encontrados com este CPF:', usersWithCPF.size);
    usersWithCPF.forEach(doc => {
      const user = doc.data();
      console.log('--- Usuário encontrado ---');
      console.log('Email:', user.email);
      console.log('UserType:', user.userType);
      console.log('Password hash:', user.password);
      console.log('-----------------------');
    });

    // 3. Buscar especificamente pelo email gerado
    const userSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    console.log('Usuário encontrado com email gerado:', userSnapshot.size);
    
    if (userSnapshot.empty) {
      console.log('❌ EMAIL NÃO ENCONTRADO NO FIRESTORE');
      console.log('Email buscado:', email);
      
      // Vamos ver qual é o email REAL que está salvo
      const allUsers = await db.collection('users').limit(10).get();
      console.log('=== AMOSTRA DE USUÁRIOS NO FIRESTORE ===');
      allUsers.forEach(doc => {
        const user = doc.data();
        console.log(`Email: ${user.email}, CPF: ${user.cpf}, Type: ${user.userType}`);
      });
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('=== DEBUG FIM ===');

    // Resto do código normal...
    const user = await verifyUserCredentials(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await admin.auth().createCustomToken(user.userId);
    res.status(200).json({ 
      userId: user.userId, 
      token, 
      userType: user.userType, 
      nomeCompleto: user.nomeCompleto, 
      email 
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };