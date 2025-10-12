const Admin = require('firebase-admin');
const logger = require('../utils/logger');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

let initialized = false;
let dbInstance;
let adminInstance;

const initializeFirebase = () => {
    if(initialized)return;
    
    try{
        const serviceAccountPath = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if(!serviceAccountPath){
            throw new Error('FIREBASE_SERVICE_ACCOUNT não está definido nas variáveis de ambiente.');
        }

        logger.info(`Caminho do serviço Firebase: ${serviceAccountPath}`);

        if(!fs.existsSync(serviceAccountPath)){
            throw new Error(`Arquivo de conta de serviço não encontrado em: ${serviceAccountPath}`);
        }

        const serviceAccount = require(path.resolve(serviceAccountPath));

        //verificar campos obrigatorios
        const requiredFields = ['project_id', 'private_key_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        if(missingFields.length > 0){
            throw new Error(`Arquivo de credenciais inválido: faltam os campos: ${missingFields.join(', ')}`);
        }
        adminInstance = Admin.initializeApp({
            credential: Admin.credential.cert(serviceAccount)
        });
        dbInstance = Admin.firestore();
        initialized = true;
        logger.info('Firebase inicializado com sucesso.');

    }catch (error){
        logger.error(`Erro ao inicializar Firebase: ${error.message}`);
        throw error;
    }     
};

const db = () => {
    if(!initialized) initializeFirebase();
    return dbInstance;
};

const admin = () => {
    if(!initialized) initializeFirebase();
    return adminInstance;
};

module.exports = { admin, db };