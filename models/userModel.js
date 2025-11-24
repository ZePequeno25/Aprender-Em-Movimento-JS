const { db } = require('../utils/firebase');
const bcrypt = require('bcrypt');

const createUser = async (userData) => {
  try {
    if (!db) {
      throw new Error('Firestore db não inicializado');
    }
    
    const { userId, ...data } = userData;
    // Use a sintaxe direta do Firestore Admin
    await db.collection('users').doc(userId).set(data);
    
  } catch (error) {
    throw new Error(`Erro ao criar usuário: ${error.message}`);
  }
};

const verifyUserCredentials = async (email, password) => {
  try {
    const snapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return null;
    }

    return { ...user, userId: userDoc.id };
  } catch (error) {
    throw new Error(`Erro ao verificar credenciais: ${error.message}`);
  }
};

const verifyUserPasswordReset = async (email, dataNascimento) => {
    try {
        console.log('🔍 [userModel] Verificando usuário para reset de senha:', { email });
        
        // Usar sintaxe do Firestore Admin
        const snapshot = await db.collection('users')
            .where('email', '==', email)
            .where('dataNascimento', '==', dataNascimento)
            .get();

        console.log('📊 [userModel] Resultado da busca:', { encontrou: !snapshot.empty });

        if(snapshot.empty){
            return null;
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();
        
        console.log('✅ [userModel] Usuário encontrado:', { 
            userId: userDoc.id,
            email: user.email 
        });
        
        return { ...user, userId: userDoc.id };

    } catch (error) {
        console.error('❌ [userModel] Erro ao verificar usuário:', error);
        throw new Error(`Erro ao verificar usuário para redefinição de senha: ${error.message}`);
    }
};

const verifyUserByCpfForPasswordReset = async (cpf, userType) => {
    try {
        console.log('🔍 [userModel] Verificando usuário por CPF para reset:', { 
            cpf: cpf.substring(0, 3) + '***',
            userType 
        });
        
        if (!db) {
            throw new Error('Firestore db não inicializado');
        }

        // ✅ Busca por CPF e userType
        const snapshot = await db.collection('users')
            .where('cpf', '==', cpf)
            .where('userType', '==', userType)
            .get();

        console.log('📊 [userModel] Resultado da busca por CPF:', { 
            encontrou: !snapshot.empty,
            quantidade: snapshot.size 
        });

        if(snapshot.empty){
            console.log('❌ [userModel] Nenhum usuário encontrado com este CPF e userType');
            return null;
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();
        
        console.log('✅ [userModel] Usuário encontrado por CPF:', { 
            userId: userDoc.id,
            email: user.email,
            nome: user.nomeCompleto
        });
        
        return { 
            ...user, 
            userId: userDoc.id 
        };

    } catch (error) {
        console.error('❌ [userModel] Erro ao verificar usuário por CPF:', error);
        throw new Error(`Erro ao verificar usuário por CPF: ${error.message}`);
    }
};

const resetUserPassword = async (userId, newPassword) => {
    try {
        console.log('🔐 [userModel] Redefinindo senha para usuário:', userId);
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.collection('users').doc(userId).update({ 
            password: hashedPassword,
            updatedAt: new Date().toISOString()
        });
        
        console.log('✅ [userModel] Senha atualizada no Firestore');

    } catch (error) {
        console.error('❌ [userModel] Erro ao redefinir senha:', error);
        throw new Error(`Erro ao redefinir senha: ${error.message}`);
    }
};

const isProfessor = async (userId) => {
  try {
    console.log('🔍 [userModel] Verificando se usuário é professor:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ [userModel] Usuário não encontrado');
      return false;
    }

    const userData = userDoc.data();
    const isProfessor = userData.userType === 'professor';
    
    console.log('✅ [userModel] Resultado da verificação:', { 
      userId, 
      userType: userData.userType, 
      isProfessor 
    });
    
    return isProfessor;
  } catch (error) {
    console.error('❌ [userModel] Erro ao verificar se é professor:', error);
    throw new Error(`Erro ao verificar permissões: ${error.message}`);
  }
};

const isStudent = async (userId) => {
  try {
    console.log('🔍 [userModel] Verificando se usuário é aluno:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ [userModel] Usuário não encontrado');
      return false;
    }

    const userData = userDoc.data();
    const isStudent = userData.userType === 'aluno';
    
    console.log('✅ [userModel] Resultado da verificação:', { 
      userId, 
      userType: userData.userType, 
      isStudent 
    });
    
    return isStudent;
  } catch (error) {
    console.error('❌ [userModel] Erro ao verificar se é aluno:', error);
    throw new Error(`Erro ao verificar permissões: ${error.message}`);
  }
};

const getUserName = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    return userData.nomeCompleto || null;
  } catch (error) {
    console.error('❌ [userModel] Erro ao obter nome do usuário:', error);
    throw new Error(`Erro ao obter nome do usuário: ${error.message}`);
  }
};

module.exports = { 
  createUser, 
  verifyUserCredentials, 
  verifyUserPasswordReset, 
  resetUserPassword, 
  verifyUserByCpfForPasswordReset, 
  isProfessor,
  isStudent,
  getUserName
};