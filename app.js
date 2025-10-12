const express = require('express');
const cors = require('cors');
const {admin} = require('./utils/firebase');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');

//carregar as variaveis de ambiente
dotenv.config({ path: path.resolve(__dirname, './.env') });

//configuro meu servidor
const app = express();

//Configuração do CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
    origin: (origin, callback) => {
        if(!origin || allowedOrigins.includes(origin)){
            callback(null, true);
        }else{
            callback(new Error('Origin not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

//Rotas iniciadas
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chats', chatRoutes);

//Middleware de tratamento de erros
app.use((err, req, res, next)=>{
    logger.error(`Erro: ${err.message}`);
    res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () =>{
    logger.info(`Servidor rodando na porta 0.0.0.0:${PORT}`);
});