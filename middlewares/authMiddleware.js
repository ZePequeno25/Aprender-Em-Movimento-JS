const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Token não fornecido ou formato inválido', 'AUTH_MIDDLEWARE');
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('🔐 [authMiddleware] Verificando token...');
    
    try {
      // ✅ Tenta verificar como ID token primeiro
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('✅ [authMiddleware] Token válido (ID token) para usuário:', decodedToken.uid);
      
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      req.teacherId = decodedToken.uid;
      
    } catch (idTokenError) {
      // ❌ Se falhar, pode ser custom token - vamos tentar uma abordagem diferente
      console.log('⚠️ [authMiddleware] Não é ID token, tentando alternativa...');
      
      // ✅ Busca o usuário no Firestore pelo token (como você faz no login)
      const userSnapshot = await admin.firestore().collection('users')
        .where('customTokens', 'array-contains', token)
        .get();
      
      if (userSnapshot.empty) {
        throw new Error('Token inválido');
      }
      
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      req.user = { uid: userDoc.id, ...userData };
      req.userId = userDoc.id;
      req.teacherId = userDoc.id;
      
      console.log('✅ [authMiddleware] Usuário autenticado via custom token:', userDoc.id);
    }
    
    next();
  } catch (error) {
    console.error('❌ [authMiddleware] Erro ao verificar token:', error);
    return res.status(401).json({ error: 'Token de autenticação inválido' });
  }
};

module.exports = authMiddleware;