const { admin } = require('../utils/firebase');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [authMiddleware] Header Authorization inválido ou faltando');
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('🔐 [authMiddleware] Verificando token JWT...');
    
    // ✅ VALIDAÇÃO CORRETA com Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    req.userId = decodedToken.uid;
    req.teacherId = decodedToken.uid;
    
    console.log(`✅ [authMiddleware] Usuário autenticado: ${decodedToken.uid}`);
    next();

  } catch (error) {
    console.error('❌ [authMiddleware] Token inválido:', error.message);
    return res.status(401).json({ error: 'Token de autenticação inválido' });
  }
};

module.exports = authMiddleware;