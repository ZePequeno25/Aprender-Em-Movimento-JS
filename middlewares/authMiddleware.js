const { admin, db } = require('../utils/firebase');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [authMiddleware] Header Authorization inválido ou faltando');
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('🔐 [authMiddleware] Iniciando verificação...');
    console.log('📏 Token recebido length:', token.length);
    console.log('🔍 Token recebido (início):', token.substring(0, 30));
    console.log('🔍 Token recebido (fim):', token.substring(token.length - 30));

    // ✅ BUSCAR TODOS OS USUÁRIOS PARA DEBUG
    console.log('🔍 [authMiddleware] Buscando TODOS os usuários para debug...');
    const allUsers = await db.collection('users').get();
    
    console.log('👥 Total de usuários no sistema:', allUsers.size);
    
    let tokenFound = false;
    allUsers.forEach(doc => {
      const userData = doc.data();
      const storedToken = userData.currentToken || '';
      
      console.log(`📋 Usuário ${doc.id}:`);
      console.log(`   - currentToken existe: ${!!userData.currentToken}`);
      console.log(`   - storedToken length: ${storedToken.length}`);
      console.log(`   - storedToken (início): ${storedToken.substring(0, 30)}`);
      
      if (storedToken === token) {
        tokenFound = true;
        console.log('🎯 ✅ TOKEN ENCONTRADO NO USUÁRIO:', doc.id);
        
        req.user = { 
          uid: doc.id, 
          ...userData 
        };
        req.userId = doc.id;
        req.teacherId = doc.id;
      }
    });

    if (tokenFound) {
      console.log('✅ [authMiddleware] Autenticação bem-sucedida!');
      next();
      return;
    }

    console.log('❌ [authMiddleware] NENHUM usuário com este token foi encontrado');
    
    // Mostrar diferença entre tokens
    if (allUsers.size > 0) {
      const firstUser = allUsers.docs[0].data();
      const firstUserToken = firstUser.currentToken || '';
      
      console.log('🔍 COMPARAÇÃO DE TOKENS:');
      console.log('📏 Token recebido length:', token.length);
      console.log('📏 Token salvo length:', firstUserToken.length);
      console.log('📝 São iguais?', token === firstUserToken);
      
      if (token.length !== firstUserToken.length) {
        console.log('⚠️ Os tokens têm comprimentos DIFERENTES!');
      }
    }

    throw new Error('Token não associado a nenhum usuário');

  } catch (error) {
    console.error('❌ [authMiddleware] Erro final:', error.message);
    return res.status(401).json({ error: 'Token de autenticação inválido' });
  }
};

module.exports = authMiddleware;