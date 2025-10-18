const { admin, db } = require('../utils/firebase');
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

    // ✅ PRIMEIRO: Tenta verificar como ID token (caso o frontend envie ID token)
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('✅ [authMiddleware] Token válido (ID token) para usuário:', decodedToken.uid);
      
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      req.teacherId = decodedToken.uid;
      next();
      return;
    } catch (idTokenError) {
      console.log('⚠️ [authMiddleware] Não é ID token, verificando como custom token...');
    }

    // ✅ SEGUNDO: Busca usuário pelo token salvo no Firestore
    console.log('🔍 [authMiddleware] Buscando usuário com este token...');
    
    const usersSnapshot = await db.collection('users')
      .where('currentToken', '==', token)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ [authMiddleware] Token não encontrado em nenhum usuário');
      throw new Error('Token inválido - não associado a nenhum usuário');
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ [authMiddleware] Usuário autenticado via custom token:', userDoc.id);
    
    req.user = { 
      uid: userDoc.id, 
      ...userData 
    };
    req.userId = userDoc.id;
    req.teacherId = userDoc.id;
    
    next();

  } catch (error) {
    console.error('❌ [authMiddleware] Erro ao verificar token:', error.message);
    return res.status(401).json({ error: 'Token de autenticação inválido' });
  }
};

module.exports = authMiddleware;