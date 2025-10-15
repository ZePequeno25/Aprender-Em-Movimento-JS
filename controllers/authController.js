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
    const { email, password, cpf, userType } = req.body;

    if (cpf && userType && password && !email) {
      console.log('=== DEBUG SENHA ===');
      console.log('Password recebido:', password);
      console.log('Tipo do password:', typeof password);
      console.log('Comprimento do password:', password.length);

      // Buscar usuário
      const userSnapshot = await db.collection('users')
        .where('cpf', '==', cpf)
        .where('userType', '==', userType)
        .get();

      if (userSnapshot.empty) {
        return res.status(401).json({ error: 'User not found' });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Hash armazenado no Firestore:', userData.password);
      console.log('Tipo do hash:', typeof userData.password);
      console.log('Comprimento do hash:', userData.password.length);

      // DEBUG: Vamos ver TODOS os dados do usuário
      console.log('=== TODOS OS DADOS DO USUÁRIO ===');
      console.log(JSON.stringify(userData, null, 2));

      // Verificar senha
      console.log('Fazendo bcrypt.compare...');
      const passwordMatch = await bcrypt.compare(password, userData.password);
      console.log('Resultado do bcrypt.compare:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ SENHA NÃO CONFERE');
        
        // DEBUG EXTRA: Testar com o CPF como senha (fallback do registro)
        console.log('Testando com CPF como senha...');
        const passwordMatchWithCPF = await bcrypt.compare(cpf, userData.password);
        console.log('Resultado com CPF como senha:', passwordMatchWithCPF);
        
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('✅ SENHA CORRETA!');

      // GERAR TOKEN
      const token = await admin.auth().createCustomToken(userDoc.id);
      
      logger.logAuth('LOGIN', userDoc.id, true, { 
        email: userData.email, 
        userType: userData.userType 
      });
      
      return res.status(200).json({ 
        userId: userDoc.id, 
        token, 
        userType: userData.userType, 
        nomeCompleto: userData.nomeCompleto, 
        email: userData.email 
      });
    }

    // SE estiver usando EMAIL para login (mantém o código original)
    if (email && password) {
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
    } else {
      return res.status(400).json({ error: 'Missing email or password' });
    }

  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };