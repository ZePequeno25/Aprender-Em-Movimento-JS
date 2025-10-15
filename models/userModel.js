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

module.exports = { createUser, verifyUserCredentials };