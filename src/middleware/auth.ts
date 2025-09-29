import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import { securityConfig } from '../config/environment';
import logger from '../utils/logger';

// Extend Request type to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
      isN8nRequest?: boolean;
    }
  }
}

// API Key authentication middleware for n8n requests
export const authenticateApiKey = (
  req: Request,
  _res: Response,
  next: NextFunction  
): void => {
  try {
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      logger.security('API key missing', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      throw new UnauthorizedError('API key is required');
    }

    if (apiKey !== securityConfig.n8nApiKey) {
      logger.security('Invalid API key attempted', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        providedKey: apiKey.substring(0, 8) + '...',
      });
      throw new UnauthorizedError('Invalid API key');
    }

    // Mark request as authenticated n8n request
    req.apiKey = apiKey;
    req.isN8nRequest = true;

    logger.info('N8N request authenticated', {
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Optional API key authentication (for mixed endpoints)
export const optionalApiKey = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const apiKey = req.header('x-api-key');

  if (apiKey) {
    if (apiKey === securityConfig.n8nApiKey) {
      req.apiKey = apiKey;
      req.isN8nRequest = true;
      logger.info('Optional N8N authentication successful', {
        path: req.path,
        method: req.method,
      });
    } else {
      logger.security('Invalid API key in optional auth', {
        ip: req.ip,
        path: req.path,
        providedKey: apiKey.substring(0, 8) + '...',
      });
    }
  }

  next();
};

// Rate limiting for unauthenticated requests
export const requireAuthForHighFrequency = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Allow n8n requests to bypass rate limiting
  if (req.isN8nRequest) {
    return next();
  }

  // For now, we'll allow all requests but log them
  // In a production environment, you might want to implement
  // stricter authentication here
  logger.info('Unauthenticated request', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
  });

  next();
};

// Middleware to check if request is from n8n
export const requireN8nAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.isN8nRequest) {
    logger.security('N8N-only endpoint accessed without proper auth', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    throw new ForbiddenError('This endpoint is only accessible via n8n workflows');
  }
  next();
};

// CORS preflight handler
export const handleCorsOptions = (
  req: Request,
  res: Response, 
  next: NextFunction
): void => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
  }
  next();
};

// Security headers middleware
export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove powered-by header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};
