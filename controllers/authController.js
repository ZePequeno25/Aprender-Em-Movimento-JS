const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');
const { createUser, verifyUserCredentials, verifyUserPasswordReset, resetUserPassword, verifyUserByCpfForPasswordReset } = require('../models/userModel');
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

    // Validações obrigatórias
    if (!nomeCompleto || !cpf || !userType || !dataNascimento) {
      logger.warn('Campos obrigatórios faltando', 'AUTH', { 
        nomeCompleto: !!nomeCompleto, 
        cpf: !!cpf, 
        userType: !!userType, 
        dataNascimento: !!dataNascimento 
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validação userType
    const validUserTypes = ['aluno', 'professor'];
    if (!validUserTypes.includes(userType)) {
      logger.warn('userType inválido', 'AUTH', { userType });
      return res.status(400).json({ error: 'Formato do userType inválido' });
    }

    // Validação CPF
    if (!/^\d{11}$/.test(cpf)) {
      logger.warn('CPF em formato inválido', 'AUTH', { cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido' });
      return res.status(400).json({ error: 'Formato do CPF inválido' });
    }

    console.log('🔍 [REGISTER] Verificando duplicação de CPF...', {
      cpf: cpf.substring(0, 3) + '***',
      userType
    });

    // ✅ VERIFICAÇÃO DE CPF DUPLICADO
    const existingUserSnapshot = await db.collection('users')
      .where('cpf', '==', cpf)
      .where('userType', '==', userType)
      .get();

    if (!existingUserSnapshot.empty) {
      const existingUser = existingUserSnapshot.docs[0].data();
      console.log('❌ [REGISTER] CPF já cadastrado:', {
        cpf: cpf.substring(0, 3) + '***',
        userType,
        existingEmail: existingUser.email
      });
      
      logger.warn('CPF já cadastrado para este tipo de usuário', 'AUTH', { 
        cpf: cpf.substring(0, 3) + '***', 
        userType 
      });
      
      return res.status(400).json({ 
        error: `Já existe um ${userType} cadastrado com este CPF` 
      });
    }

    console.log('✅ [REGISTER] CPF livre para cadastro');

    // Gerar senha (customizada ou CPF como padrão)
    const finalPassword = password || cpf;
    
    console.log('🔐 [REGISTER] Gerando hash da senha...');
    const passwordHash = await bcrypt.hash(finalPassword, SALT_ROUNDS);
    const hashKey = passwordHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const email = `${cpf}_${userType}_${hashKey}@saberemmovimento.com`;

    console.log('📧 [REGISTER] Email gerado:', email);
    console.log('🔑 [REGISTER] HashKey:', hashKey);

    // Verificar se email já existe no Firebase Auth
    console.log('🔍 [REGISTER] Verificando email no Firebase Auth...');
    try {
      await admin.auth().getUserByEmail(email);
      // Se não lançou erro, email já existe
      console.log('❌ [REGISTER] Email já existe no Firebase Auth');
      return res.status(400).json({ error: 'Erro interno no cadastro - email duplicado' });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        console.error('❌ [REGISTER] Erro ao verificar email:', error);
        throw error;
      }
      console.log('✅ [REGISTER] Email livre no Firebase Auth');
    }

    // Criar usuário no Firebase Authentication
    console.log('👤 [REGISTER] Criando usuário no Firebase Auth...');
    const userRecord = await admin.auth().createUser({ 
      email, 
      password: finalPassword,
      displayName: nomeCompleto,
      disabled: false
    });

    console.log('✅ [REGISTER] Usuário criado no Auth:', userRecord.uid);

    // Preparar dados para Firestore
    const userData = {
      userId: userRecord.uid,
      email,
      password: passwordHash,
      userType,
      nomeCompleto,
      cpf,
      dataNascimento,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Salvar no Firestore
    console.log('💾 [REGISTER] Salvando usuário no Firestore...');
    await createUser(userData);

    // Log de sucesso
    logger.logAuth('REGISTER', userRecord.uid, true, { 
      email, 
      userType,
      usedCustomPassword: !!password 
    });

    console.log('🎉 [REGISTER] Cadastro concluído com sucesso!', {
      userId: userRecord.uid,
      email,
      userType
    });

    // Response de sucesso
    res.status(201).json({ 
      userId: userRecord.uid, 
      email, 
      message: 'User registered successfully',
      usedDefaultPassword: !password
    });

  } catch (error) {
    console.error('❌ [REGISTER] Erro no cadastro:', error);
    logger.logError(error, 'AUTH');
    
    // Tratamento de erros específicos do Firebase
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Senha muito fraca' });
    }
    if (error.code === 'auth/operation-not-allowed') {
      return res.status(400).json({ error: 'Operação não permitida' });
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

const verifyUserForPasswordResetHandler = async (req, res) => {
    logger.logRequest(req, 'PASSWORD_RESET');
    
    try {
        const { email, dataNascimento, cpf, userType } = req.body;
        
        console.log('🔍 [PasswordReset] Verificando usuário:', { 
            email, 
            dataNascimento,
            cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
            userType
        });

        let user;

        // ✅ OPÇÃO 1: Verificação por CPF + userType (seu caso)
        if (cpf && userType && !email) {
            if (!/^\d{11}$/.test(cpf)) {
                return res.status(400).json({ error: 'Formato do CPF inválido' });
            }

            const validUserTypes = ['aluno', 'professor'];
            if (!validUserTypes.includes(userType)) {
                return res.status(400).json({ error: 'Formato do userType inválido' });
            }

            user = await verifyUserByCpfForPasswordReset(cpf, userType);

        // ✅ OPÇÃO 2: Verificação por email + dataNascimento (original)
        } else if (email && dataNascimento && !cpf) {
            user = await verifyUserByEmailForPasswordReset(email, dataNascimento);

        } else {
            logger.warn('Campos obrigatórios faltando', 'PASSWORD_RESET', { 
                email: !!email, 
                dataNascimento: !!dataNascimento,
                cpf: !!cpf,
                userType: !!userType
            });
            return res.status(400).json({ 
                error: 'Forneça (email + dataNascimento) OU (cpf + userType)' 
            });
        }
        
        if(!user){
            logger.warn('Credenciais inválidas', 'PASSWORD_RESET', { 
                cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
                userType 
            });
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        logger.info(`Usuário verificado para redefinição de senha: ${user.userId}`, 'PASSWORD_RESET');
        
        console.log('✅ [PasswordReset] Usuário verificado com sucesso:', {
            userId: user.userId,
            email: user.email
        });

        res.status(200).json({ 
            userId: user.userId, 
            email: user.email, // ← Retorna o email para facilitar
            message: 'Usuário verificado com sucesso' 
        });

    } catch (error) {
        console.error('❌ [PasswordReset] Erro ao verificar usuário:', error);
        logger.error(`Erro ao verificar usuário para redefinição de senha: ${error.message}`, 'PASSWORD_RESET');
        res.status(500).json({ error: error.message });
    }
};

const resetPassword = async (req, res) => {
    logger.logRequest(req, 'PASSWORD_RESET');
    
    try {
        const { userId, newPassword } = req.body;
        
        console.log('🔐 [ResetPassword] Redefinindo senha:', { 
            userId, 
            newPasswordLength: newPassword?.length 
        });

        if(!userId || !newPassword){
            logger.warn('UserId ou newPassword ausentes', 'PASSWORD_RESET', { 
                userId: !!userId, 
                newPassword: !!newPassword 
            });
            return res.status(400).json({ error: 'UserId e nova senha são obrigatórios' });
        }

        // Validação de força da senha (opcional)
        if(newPassword.length < 6){
            return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        console.log('🔄 [ResetPassword] Atualizando senha no Firestore...');
        // Atualizar no Firestore (com hash)
        await resetUserPassword(userId, newPassword);

        console.log('🔄 [ResetPassword] Atualizando senha no Firebase Auth...');
        // Atualizar no Firebase Authentication
        await admin.auth().updateUser(userId, { 
            password: newPassword 
        });

        logger.info(`Senha redefinida para usuário: ${userId}`, 'PASSWORD_RESET');
        
        console.log('✅ [ResetPassword] Senha redefinida com sucesso');

        res.status(200).json({ 
            message: 'Senha redefinida com sucesso' 
        });

    } catch (error) {
        console.error('❌ [ResetPassword] Erro ao redefinir senha:', error);
        logger.error(`Erro ao redefinir senha: ${error.message}`, 'PASSWORD_RESET');
        
        // Tratamento de erros específicos do Firebase
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        if (error.code === 'auth/weak-password') {
            return res.status(400).json({ error: 'Senha muito fraca' });
        }
        
        res.status(500).json({ error: error.message });
    }
};

module.exports = { register, login, resetPassword, verifyUserForPasswordResetHandler };