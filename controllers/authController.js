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
    if (!nomeCompleto || !cpf || !userType || !dataNascimento || !password) {
      logger.warn('Campos obrigatórios faltando', 'AUTH', { 
        nomeCompleto: !!nomeCompleto, 
        cpf: !!cpf, 
        userType: !!userType, 
        dataNascimento: !!dataNascimento,
        password: !!password
      });
      return res.status(400).json({ error: 'Todos os campos são obrigatórios, incluindo a senha' });
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

    // ✅ VALIDAR QUE A SENHA NÃO É IGUAL AO CPF
    if (password === cpf) {
      console.log('❌ [REGISTER] Senha não pode ser igual ao CPF');
      logger.warn('Senha igual ao CPF', 'AUTH');
      return res.status(400).json({ error: 'A senha não pode ser igual ao CPF' });
    }

    // ✅ VALIDAR FORÇA DA SENHA (mínimo 6 caracteres)
    if (password.length < 6) {
      console.log('❌ [REGISTER] Senha muito curta');
      logger.warn('Senha muito curta', 'AUTH');
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    // Usar a senha fornecida pelo usuário
    const finalPassword = password;
    
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

    // ✅ Gerar código de professor automaticamente se for professor
    if (userType === 'professor') {
      try {
        const { createTeacherCode } = require('../models/teacherCodeModel');
        const linkCode = `PROF_${userRecord.uid.slice(0, 8).toUpperCase()}`;
        await createTeacherCode(userRecord.uid, linkCode);
        console.log('✅ [REGISTER] Código de professor gerado automaticamente:', linkCode);
      } catch (codeError) {
        console.error('⚠️ [REGISTER] Erro ao gerar código de professor (não crítico):', codeError.message);
        // Não falha o registro se não conseguir gerar o código
      }
    }

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
      
      // ✅ NORMALIZA OS DADOS
      const normalizedCpf = cpf.replace(/\D/g, '');
      const normalizedUserType = userType.toLowerCase();
      
      console.log('CPF (normalizado):', normalizedCpf);
      console.log('UserType (normalizado):', normalizedUserType);

      // DEBUG: Ver todos os usuários
      const debugSnapshot = await db.collection('users').limit(10).get();
      console.log('👥 Primeiros 10 usuários no sistema:');
      debugSnapshot.forEach(doc => {
        const user = doc.data();
        console.log(`- ${doc.id}: ${user.nomeCompleto} (${user.userType}) - CPF: ${user.cpf}`);
      });

      // Buscar usuário
      const userSnapshot = await db.collection('users')
        .where('cpf', '==', normalizedCpf)
        .where('userType', '==', normalizedUserType)
        .get();

      console.log('🎯 Usuários encontrados:', userSnapshot.size);

      if (userSnapshot.empty) {
        console.log('❌ Nenhum usuário com CPF:', normalizedCpf, 'e tipo:', normalizedUserType);
        return res.status(401).json({ error: 'Tipo ou CPF ou Senha incorretos' });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('✅ Usuário encontrado:', userData.email);
      console.log('Hash armazenado:', userData.password.substring(0, 20) + '...');

      // VERIFICAR SENHA DIRETAMENTE COM O HASH SALVO
      console.log('Verificando senha com bcrypt.compare...');
      const passwordMatch = await bcrypt.compare(password, userData.password);
      console.log('Resultado:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ Senha incorreta');
        return res.status(401).json({ error: 'Tipo ou CPF ou Senha incorretos' });
      }

      console.log('✅ Login bem-sucedido!');

      // GERAR TOKEN
      const token = await admin.auth().createCustomToken(userDoc.id);

      console.log('🔑 [LOGIN] Token gerado:');
      console.log('📏 Comprimento:', token.length);
      console.log('📝 Primeiros 50 chars:', token.substring(0, 50));
      console.log('📝 Últimos 50 chars:', token.substring(token.length - 50));

      // ✅ SALVAR O TOKEN NO CAMPO CORRETO (currentToken)
      console.log('💾 [LOGIN] Salvando token no Firestore...');
      await db.collection('users').doc(userDoc.id).update({
        currentToken: token, // ✅ Agora salva no campo currentToken
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Token salvo no campo currentToken do usuário:', userDoc.id);
      
      // ✅ VERIFICAR SE SALVOU CORRETAMENTE
      const userAfterSave = await db.collection('users').doc(userDoc.id).get();
      const savedToken = userAfterSave.data().currentToken;

      console.log('✅ [LOGIN] Token salvo no Firestore:');
      console.log('📏 Comprimento salvo:', savedToken.length);
      console.log('📝 Primeiros 50 chars salvos:', savedToken.substring(0, 50));
      console.log('🔍 Tokens são IGUAIS?', token === savedToken);

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
        return res.status(401).json({ error: 'Tipo ou CPF ou Senha incorretos' });
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

        // ✅ Verificação por CPF + userType
        if (cpf && userType && !email) {
            console.log('🔄 [PasswordReset] Usando verificação por CPF...');
            
            if (!/^\d{11}$/.test(cpf)) {
                console.log('❌ [PasswordReset] CPF inválido:', cpf);
                return res.status(400).json({ error: 'Formato do CPF inválido' });
            }

            const validUserTypes = ['aluno', 'professor'];
            if (!validUserTypes.includes(userType)) {
                console.log('❌ [PasswordReset] UserType inválido:', userType);
                return res.status(400).json({ error: 'Formato do userType inválido' });
            }

            // ✅ Chamada CORRETA da função
            user = await verifyUserByCpfForPasswordReset(cpf, userType);

        // ✅ Verificação por email + dataNascimento
        } else if (email && dataNascimento && !cpf) {
            console.log('🔄 [PasswordReset] Usando verificação por email...');
            user = await verifyUserByEmailForPasswordReset(email, dataNascimento);

        } else {
            console.log('❌ [PasswordReset] Campos insuficientes');
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
            console.log('❌ [PasswordReset] Usuário não encontrado');
            logger.warn('Credenciais inválidas', 'PASSWORD_RESET', { 
                cpf: cpf ? cpf.substring(0, 3) + '***' : 'não fornecido',
                userType 
            });
            return res.status(401).json({ error: 'CPF não encontrado ou tipo de usuário incorreto' });
        }

        console.log('✅ [PasswordReset] Usuário verificado com sucesso:', {
            userId: user.userId,
            email: user.email
        });

        logger.info(`Usuário verificado para redefinição de senha: ${user.userId}`, 'PASSWORD_RESET');

        res.status(200).json({ 
            userId: user.userId, 
            email: user.email,
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