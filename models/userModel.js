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
    if (!db) {
      throw new Error('Firestore db não inicializado');
    }

    console.log('🔍 verifyUserCredentials - Buscando email:', email);
    
    const snapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    console.log('🔍 verifyUserCredentials - Resultado:', {
      encontrouUsuarios: snapshot.size,
      emailBuscado: email
    });

    if (snapshot.empty) {
      console.log('❌ Usuário não encontrado para email:', email);
      return null;
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    
    console.log('🔍 verifyUserCredentials - Dados do usuário:', {
      userId: userDoc.id,
      email: user.email,
      temPassword: !!user.password,
      passwordHash: user.password ? user.password.substring(0, 20) + '...' : 'não tem'
    });

    console.log('🔍 Comparando senhas...');
    console.log('   - Password input:', password);
    console.log('   - Password hash:', user.password);
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    console.log('🔍 Resultado da comparação:', passwordMatch);

    if (!passwordMatch) {
      console.log('❌ Senha não confere');
      return null;
    }

    console.log('✅ Credenciais válidas');
    return { ...user, userId: userDoc.id };
  } catch (error) {
    console.error('❌ Erro em verifyUserCredentials:', error);
    throw new Error(`Erro ao verificar credenciais: ${error.message}`);
  }
};

module.exports = { createUser, verifyUserCredentials };