const admin = require('firebase-admin');
const logger = require('../utils/logger');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let db;

try{
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    logger.info('Firebase inicializado com sucesso.');
}catch (error){
    logger.error(`Erro ao inicializar Firebase: ${error.message}`);
    throw error;
}

module.exports = { admin, db };