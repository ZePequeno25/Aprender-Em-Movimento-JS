const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '.env') });
logger.info(`Variáveis de ambiente carregadas: FIREBASE_SERVICE_ACCOUNT=${process.env.FIREBASE_SERVICE_ACCOUNT ? 'definida' : 'não definida'}, ALLOWED_ORIGINS=${process.env.ALLOWED_ORIGINS || 'não definida'}`);

const app = express();

// Configurar CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://id-preview--77c82926-cc52-4e97-9f3b-585910fae583.lovable.app', 'http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      logger.info('Origem da requisição', 'APP', { origin: origin || 'sem origem' });
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.error(`Erro: Origin ${origin} not allowed by CORS`);
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

app.use(express.json());

// Rotas
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));
app.use('/api', authRoutes);
app.use('/api', questionRoutes);
app.use('/api', relationshipRoutes);
app.use('/api', commentRoutes);
app.use('/api', chatRoutes);
// Middleware de erro
app.use((err, req, res, next) => {
  logger.error(`Erro: ${err.message}`);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});
