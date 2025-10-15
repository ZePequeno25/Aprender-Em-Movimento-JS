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
      console.log('=== DEBUG NOVA LÓGICA ===');
      console.log('Password recebido:', password);
      console.log('CPF:', cpf);
      console.log('UserType:', userType);

      // Buscar usuário por CPF e userType
      const userSnapshot = await db.collection('users')
        .where('cpf', '==', cpf)
        .where('userType', '==', userType)
        .get();

      if (userSnapshot.empty) {
        return res.status(401).json({ error: 'User not found' });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('Email do usuário:', userData.email);
      console.log('Hash armazenado:', userData.password);

      // EXTRAIR A CHAVE DO EMAIL (parte do hash)
      const emailParts = userData.email.split('_');
      const hashKeyFromEmail = emailParts[2].split('@')[0]; // "2b10m86tRtA2Q7bE"
      console.log('Chave extraída do email:', hashKeyFromEmail);

      // GERAR O HASH DA SENHA ENVIADA NO LOGIN
      const passwordHashFromLogin = await bcrypt.hash(password, SALT_ROUNDS);
      console.log('Hash gerado no login:', passwordHashFromLogin);

      // EXTRAIR A CHAVE DO HASH GERADO (mesmo processo do registro)
      const hashKeyFromLogin = passwordHashFromLogin.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      console.log('Chave gerada no login:', hashKeyFromLogin);

      // VERIFICAR SE AS CHAVES SÃO IGUAIS
      const keysMatch = hashKeyFromLogin === hashKeyFromEmail;
      console.log('Chaves coincidem?:', keysMatch);

      if (!keysMatch) {
        console.log('❌ CHAVES NÃO COINCIDEM - Login falhou');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('✅ CHAVES COINCIDEM - Login autorizado');

      // VERIFICAR A SENHA TAMBÉM (para garantir)
      const passwordMatch = await bcrypt.compare(password, userData.password);
      console.log('Senha confere com bcrypt.compare?:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ SENHA NÃO CONFERE - Login falhou');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('✅ LOGIN BEM-SUCEDIDO!');

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

    // ... resto do código para login com email
  } catch (error) {
    logger.logError(error, 'AUTH');
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };