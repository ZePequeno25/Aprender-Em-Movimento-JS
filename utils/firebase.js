try {
  const admin = require('firebase-admin');
  const logger = require('./logger');

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    logger.error('Variável de ambiente FIREBASE_SERVICE_ACCOUNT não definida');
    throw new Error('FIREBASE_SERVICE_ACCOUNT não definida');
  }

  // Parse do JSON da conta de serviço
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  // Inicializar o Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // Inicializar Firestore
  const db = admin.firestore();
  logger.info('Firebase inicializado com sucesso');
  logger.debug('Firestore instance:', !!db);

  module.exports = { admin, db };
} catch (error) {
  logger.error('Erro ao inicializar Firebase:', error.message);
  throw error;
}