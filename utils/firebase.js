const logger = require('./logger');

let admin, db;

try {
  admin = require('firebase-admin');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    logger.error('Variável de ambiente FIREBASE_SERVICE_ACCOUNT não definida', 'FIREBASE');
    throw new Error('FIREBASE_SERVICE_ACCOUNT não definida');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    logger.debug('FIREBASE_SERVICE_ACCOUNT parseado com sucesso', 'FIREBASE', { project_id: serviceAccount.project_id });
  } catch (error) {
    logger.error('Erro ao parsear FIREBASE_SERVICE_ACCOUNT', 'FIREBASE', { error: error.message });
    throw error;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  logger.info('Firebase inicializado com sucesso', 'FIREBASE');
  logger.debug('Firestore instance inicializada', 'FIREBASE', { dbInitialized: !!db });

  module.exports = { admin, db };
} catch (error) {
  logger.error(`Erro ao inicializar Firebase: ${error.message}`, 'FIREBASE', { stack: error.stack });
  module.exports = { admin: null, db: null }; // Exporta null em caso de erro
  throw error;
}