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

    // ✅ PRIMEIRO: Tenta verificar como ID token
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

    // ✅ SEGUNDO: Busca usuário pelo currentToken no Firestore
    console.log('🔍 [authMiddleware] Buscando usuário com currentToken...');
    
    const usersSnapshot = await db.collection('users')
      .where('currentToken', '==', token)
      .get();

    console.log('📊 [authMiddleware] Usuários encontrados com este token:', usersSnapshot.size);

    if (usersSnapshot.empty) {
      console.log('❌ [authMiddleware] Nenhum usuário com este currentToken');
      
      // ✅ TENTATIVA ALTERNATIVA: Buscar por UID extraído do token
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const userId = decoded.uid;
        
        if (userId) {
          console.log('🔍 [authMiddleware] Tentando buscar usuário por UID:', userId);
          const userDoc = await db.collection('users').doc(userId).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('✅ [authMiddleware] Usuário validado via UID do token:', userId);
            
            req.user = { uid: userId, ...userData };
            req.userId = userId;
            req.teacherId = userId;
            next();
            return;
          }
        }
      } catch (decodeError) {
        console.log('❌ [authMiddleware] Não foi possível extrair UID do token');
      }
      
      throw new Error('Token não associado a nenhum usuário');
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ [authMiddleware] Usuário autenticado via currentToken:', userDoc.id);
    
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