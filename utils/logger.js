const winston = require('winston');
const path = require('path');

// Função para capturar arquivo e linha da chamada
const getCallerInfo = () => {
  const stack = new Error().stack.split('\n');
  // Pega a terceira linha da pilha (ignorando a chamada do logger e da função getCallerInfo)
  const callerLine = stack[3] || '';
  const match = callerLine.match(/\(([^:]+):(\d+):(\d+)\)/) || callerLine.match(/at\s+(.+):(\d+):(\d+)/);
  if (match) {
    return {
      file: path.basename(match[1]),
      line: match[2],
    };
  }
  return { file: 'unknown', line: 'unknown' };
};

// Formato personalizado para incluir arquivo, linha e contexto
const customFormat = winston.format((info) => {
  const callerInfo = getCallerInfo();
  info.file = callerInfo.file;
  info.line = callerInfo.line;
  // Adiciona stack trace para erros
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

// Funções de log com contexto
const logWithContext = (level, message, context, meta = {}) => {
  const logMessage = context ? `[${context}] ${message}` : message;
  logger[level](logMessage, { ...meta, context });
};

// Funções utilitárias para facilitar o uso com contexto
module.exports = {
  logRequest: (req, context) => {
    logWithContext('info', `Requisição recebida: ${req.method} ${req.url}`, context, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });
  },
  logAuth: (action, userId, success, meta) => {
    logWithContext('info', `${action} ${success ? 'bem-sucedido' : 'falhou'} para usuário ${userId}`, 'AUTH', {
      userId,
      success,
      ...meta,
    });
  },
  logError: (error, context) => {
    logWithContext('error', error.message, context, { stack: error.stack });
  },
  info: (message, context, meta) => logWithContext('info', message, context, meta),
  warn: (message, context, meta) => logWithContext('warn', message, context, meta),
  debug: (message, context, meta) => logWithContext('debug', message, context, meta),
  error: (message, context, meta) => logWithContext('error', message, context, meta),
};