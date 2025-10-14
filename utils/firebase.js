try {
  const admin = require('firebase-admin');
  const logger = require('./logger');

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    logger.error('Variável de ambiente FIREBASE_SERVICE_ACCOUNT não definida', 'FIREBASE');
    throw new Error('FIREBASE_SERVICE_ACCOUNT não definida');
  }

  // Parse do JSON da conta de serviço
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    logger.debug('FIREBASE_SERVICE_ACCOUNT parseado com sucesso', 'FIREBASE', { project_id: serviceAccount.project_id });
  } catch (error) {
    logger.error('Erro ao parsear FIREBASE_SERVICE_ACCOUNT', 'FIREBASE', { error: error.message });
    throw error;
  }

  // Inicializar o Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // Inicializar Firestore
  const db = admin.firestore();
  logger.info('Firebase inicializado com sucesso', 'FIREBASE');
  logger.debug('Firestore instance inicializada', 'FIREBASE', { dbInitialized: !!db });

  module.exports = { admin, db };
} catch (error) {
  logger.error(`Erro ao inicializar Firebase: ${error.message}`, 'FIREBASE', { stack: error.stack });
  throw error;
}