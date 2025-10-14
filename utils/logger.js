/**
 * ==================== SISTEMA DE LOGGING ====================
 * 
 * DESCRIÇÃO:
 * Sistema centralizado de logs usando Winston
 * Compatível com Windows e Linux
 * 
 * NÍVEIS DE LOG:
 * - error: Erros críticos que precisam atenção imediata
 * - warn: Avisos de possíveis problemas
 * - info: Informações gerais do fluxo da aplicação
 * - http: Requisições HTTP
 * - debug: Informações detalhadas para debug
 * 
 * ARQUIVOS DE LOG:
 * - logs/error.log: Apenas erros
 * - logs/combined.log: Todos os logs
 * - logs/debug.log: Logs de debug detalhados
 * - Console: Saída colorida para desenvolvimento
 * 
 * FORMATO:
 * [TIMESTAMP] [NÍVEL] [ARQUIVO:LINHA] mensagem {metadata}
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir (compatível Windows/Linux)
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Formato customizado para console (mais legível)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `[${timestamp}] ${level}: ${message}`;
        
        // Adicionar metadata se existir
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata, null, 2)}`;
        }
        
        return msg;
    })
);

// Formato para arquivos (JSON para fácil parsing)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        // Console - formato colorido e legível
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // Arquivo de erros apenas
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Arquivo com todos os logs
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Arquivo de debug (apenas se LOG_LEVEL=debug)
        new winston.transports.File({ 
            filename: path.join(logsDir, 'debug.log'),
            level: 'debug',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 3
        })
    ]
});

/**
 * Funções auxiliares para logging estruturado
 */
logger.logRequest = (req, message = 'Requisição recebida') => {
    logger.info(message, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: req.body ? JSON.stringify(req.body).substring(0, 200) : 'vazio'
    });
};

logger.logError = (error, context = '') => {
    logger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
        stack: error.stack,
        name: error.name,
        code: error.code
    });
};

logger.logAuth = (action, userId, success, details = {}) => {
    logger.info(`[AUTH] ${action}`, {
        userId,
        success,
        ...details
    });
};

logger.logDatabase = (action, collection, success, details = {}) => {
    logger.info(`[DATABASE] ${action} em ${collection}`, {
        success,
        ...details
    });
};

module.exports = logger;