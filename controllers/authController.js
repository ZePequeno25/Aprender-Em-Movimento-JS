const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials } = require('../models/userModel');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const register = async (req, res) => {
  logger.logRequest(req, 'AUTH');
  try {
    const { nomeCompleto, cpf, userType, dataNascimento, password } = req.body;
    
    logger.debug('Dados recebidos para registro', 'AUTH', {
      nomeCompleto,
      cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
      userType,
      dataNascimento,
      hasCustomPassword: !!password
    });

    if (!nomeCompleto || !cpf || !userType || !dataNascimento) {
      logger.warn('Campos obrigatórios faltando', 'AUTH', { 
        nomeCompleto: !!nomeCompleto, 
        cpf: !!cpf, 
        userType: !!userType, 
        dataNascimento: !!dataNascimento 
      });
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

    // ✅ SENHA CUSTOMIZADA: Se não veio password, usa CPF como padrão
    const finalPassword = password || cpf;
    
    console.log('=== REGISTRO - GERANDO EMAIL ===');
    console.log('CPF:', cpf);
    console.log('Senha a ser usada:', finalPassword);
    console.log('UserType:', userType);

    // Gerar hash da senha (customizada ou CPF)
    const passwordHash = await bcrypt.hash(finalPassword, SALT_ROUNDS);
    const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const email = `${cpf}_${userType}_${hashKey}@saberemmovimento.com`;

    console.log('Hash gerado:', passwordHash);
    console.log('Chave extraída:', hashKey);
    console.log('Email gerado:', email);

    logger.debug('Criando usuário no Firebase Auth', 'AUTH', { email });
    
    // Criar usuário no Firebase Auth com a senha escolhida
    const userRecord = await admin.auth().createUser({ 
      email, 
      password: finalPassword  // ✅ Usa a senha customizada ou CPF
    });

    const userData = {
      userId: userRecord.uid,
      email,
      password: passwordHash,  // ✅ Hash da senha real
      userType,
      nomeCompleto,
      cpf,
      dataNascimento,
    };

    await createUser(userData);
    
    logger.logAuth('REGISTER', userRecord.uid, true, { 
      email, 
      userType,
      usedCustomPassword: !!password 
    });
    
    res.status(201).json({ 
      userId: userRecord.uid, 
      email, 
      message: 'User registered successfully',
      usedDefaultPassword: !password // Indica se usou senha padrão
    });
  } catch (error) {
    logger.logError(error, 'AUTH');
    
    // Tratamento de erros específicos do Firebase Auth
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Email inválido' });
    }
    
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  logger.logRequest(req, 'AUTH');
  
  try {
    const { email, password, cpf, userType } = req.body;

    // Login com CPF + userType
    if (cpf && userType && password && !email) {
      console.log('=== LOGIN SIMPLIFICADO ===');
      console.log('CPF:', cpf.substring(0, 3) + '***');
      console.log('UserType:', userType);
      console.log('Password recebido:', password);

      // Buscar usuário por CPF e userType
      const userSnapshot = await db.collection('users')
        .where('cpf', '==', cpf)
        .where('userType', '==', userType)
        .get();

      if (userSnapshot.empty) {
        console.log('❌ Usuário não encontrado');
        return res.status(401).json({ error: 'User not found' });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Usuário encontrado:', userData.email);
      console.log('Hash armazenado:', userData.password.substring(0, 20) + '...');

      // VERIFICAR SENHA DIRETAMENTE COM O HASH SALVO
      console.log('Verificando senha com bcrypt.compare...');
      const passwordMatch = await bcrypt.compare(password, userData.password);
      console.log('Resultado:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ Senha incorreta');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('✅ Login bem-sucedido!');

      // GERAR TOKEN
      const token = await admin.auth().createCustomToken(userDoc.id);
      
      return res.status(200).json({ 
        userId: userDoc.id, 
        token, 
        userType: userData.userType, 
        nomeCompleto: userData.nomeCompleto, 
        email: userData.email 
      });
    }

    // Login com email (mantém original)
    if (email && password) {
      const user = await verifyUserCredentials(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = await admin.auth().createCustomToken(user.userId);
      return res.status(200).json({ 
        userId: user.userId, 
        token, 
        userType: user.userType, 
        nomeCompleto: user.nomeCompleto, 
        email 
      });
    }

    return res.status(400).json({ error: 'Missing required fields' });

  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };