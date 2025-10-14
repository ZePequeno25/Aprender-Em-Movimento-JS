const admin = require('firebase-admin');
const logger = require('./logger');

let adminApp, db;

try {
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

  // Verifica se já foi inicializado
  if (admin.apps.length === 0) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase inicializado com sucesso', 'FIREBASE');
  } else {
    adminApp = admin.app();
    logger.info('Firebase já estava inicializado, usando instância existente', 'FIREBASE');
  }

  db = adminApp.firestore();
  logger.debug('Firestore instance inicializada', 'FIREBASE', { dbInitialized: !!db });

} catch (error) {
  logger.error(`Erro ao inicializar Firebase: ${error.message}`, 'FIREBASE', { stack: error.stack });
  throw error;
}

module.exports = { admin, db };