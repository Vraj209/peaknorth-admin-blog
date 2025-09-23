import winston from 'winston';
import { loggingConfig, isDevelopment } from '../config/environment';
import path from 'path';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: isDevelopment }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create transports
const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: isDevelopment ? 'debug' : loggingConfig.level,
    format: logFormat,
  })
);

// File transports (only in production or when specified)
if (!isDevelopment || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Ensure logs directory exists
  const logsDir = path.dirname(loggingConfig.filePath);
  
  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: loggingConfig.filePath,
      level: loggingConfig.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: loggingConfig.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  transports,
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: isDevelopment ? [] : [
    new winston.transports.File({
      filename: path.join(path.dirname(loggingConfig.filePath), 'exceptions.log'),
    }),
  ],
  rejectionHandlers: isDevelopment ? [] : [
    new winston.transports.File({
      filename: path.join(path.dirname(loggingConfig.filePath), 'rejections.log'),
    }),
  ],
  exitOnError: false,
});

// Add custom methods for common use cases
interface CustomLogger extends winston.Logger {
  request: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  database: (message: string, meta?: any) => void;
  external: (message: string, meta?: any) => void;
  performance: (message: string, meta?: any) => void;
}

const customLogger = logger as CustomLogger;

// Custom log methods
customLogger.request = (message: string, meta?: any) => {
  logger.info(message, { category: 'request', ...meta });
};

customLogger.security = (message: string, meta?: any) => {
  logger.warn(message, { category: 'security', ...meta });
};

customLogger.database = (message: string, meta?: any) => {
  logger.info(message, { category: 'database', ...meta });
};

customLogger.external = (message: string, meta?: any) => {
  logger.info(message, { category: 'external', ...meta });
};

customLogger.performance = (message: string, meta?: any) => {
  logger.info(message, { category: 'performance', ...meta });
};

// Stream for Morgan HTTP logger
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim(), { category: 'http' });
  },
};

export default customLogger;
