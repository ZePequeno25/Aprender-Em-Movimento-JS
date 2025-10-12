const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
console.log('Variáveis de ambiente carregadas:');
console.log('PORT:', process.env.PORT);
console.log('FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);