const winston = require('winston');
const path = require('path');

// Função para capturar arquivo e linha da chamada
const getCallerInfo = () => {
  const stack = new Error().stack.split('\n');
  // Pular as primeiras 4 linhas para ignorar chamadas internas do Winston e getCallerInfo
  for (let i = 4; i < stack.length; i++) {
    const callerLine = stack[i] || '';
    const match = callerLine.match(/\(([^:]+):(\d+):(\d+)\)/) || callerLine.match(/at\s+(.+):(\d+):(\d+)/);
    if (match) {
      const file = path.basename(match[1]);
      if (!file.includes('winston') && !file.includes('combine.js') && !file.includes('node_modules')) {
        return { file, line: match[2] };
      }
    }
  }
  return { file: 'unknown', line: 'unknown' };
};

// Formato personalizado para incluir arquivo, linha e contexto
const customFormat = winston.format((info) => {
  const callerInfo = getCallerInfo();
  info.file = callerInfo.file;
  info.line = callerInfo.line;
  if (info.level === 'error' && info.stack) {
    info.stackTrace = info.stack;
  }
  return info;
});

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ],
});

// Funções utilitárias para facilitar o uso com contexto
module.exports = {
  logRequest: (req, context) => {
    const logMessage = `Requisição recebida: ${req.method} ${req.url}`;
    logger.info(logMessage, context, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });
  },
  logAuth: (action, userId, success, meta) => {
    const logMessage = `${action} ${success ? 'bem-sucedido' : 'falhou'} para usuário ${userId}`;
    logger.info(logMessage, 'AUTH', {
      userId,
      success,
      ...meta,
    });
  },
  logError: (error, context) => {
    logger.error(error.message, context, { stack: error.stack });
  },
  info: (message, context, meta) => logger.info(message, context, meta),
  warn: (message, context, meta) => logger.warn(message, context, meta),
  debug: (message, context, meta) => logger.debug(message, context, meta),
  error: (message, context, meta) => logger.error(message, context, meta),
};