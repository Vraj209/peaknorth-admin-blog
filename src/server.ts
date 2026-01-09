import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';

// Import configurations
import { 
  serverConfig, 
  urlsConfig, 
  securityConfig, 
  featureFlagsConfig
} from './config/environment';
import { databaseManager } from './config/database';

// Import middleware
import { 
  errorHandler, 
  notFoundHandler, 
  setupProcessErrorHandlers 
} from './middleware/errorHandler';
import { 
  handleCorsOptions, 
  securityHeaders 
} from './middleware/auth';

// Import routes
import ideasRoutes from './routes/ideas';
import postsRoutes from './routes/posts';
import publishRoutes from './routes/publish';

// Import utilities
import logger from './utils/logger';
import { ApiResponse, HealthStatus } from './types/common';

// Create Express app
const app = express();

// Setup process error handlers
setupProcessErrorHandlers();

// Trust proxy (for accurate IP addresses behind load balancers)
app.set('trust proxy', 1);

// Security middleware
if (featureFlagsConfig.enableCors) {
  app.use(cors({
    origin: [
      urlsConfig.frontend,
      urlsConfig.adminDashboard,
      urlsConfig.publicBlog,
      'https://peaknorth-admin-blog.vercel.app',
      'https://peaknorth-admin-blog-frontend.vercel.app',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  }));
}

// Handle CORS preflight requests
app.use(handleCorsOptions);

// Security headers
app.use(securityHeaders);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
if (featureFlagsConfig.enableRateLimiting) {
  const limiter = rateLimit({
    windowMs: securityConfig.rateLimitWindowMs,
    max: securityConfig.rateLimitMaxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      timestamp: Date.now(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for n8n requests
    skip: (req) => {
      return req.header('x-api-key') === securityConfig.n8nApiKey;
    },
  });
  app.use(limiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (featureFlagsConfig.enableRequestLogging) {
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.request(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        isN8nRequest: req.header('x-api-key') === securityConfig.n8nApiKey,
      });
    });
    
    next();
  });
}

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const healthStatus = await databaseManager.healthCheck();
    const status: HealthStatus = {
      status: healthStatus.firebase ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: {
        firebase: healthStatus.firebase ? 'up' : 'down',
        cache: healthStatus.cache ? 'up' : 'down'
      },
      environment: serverConfig.nodeEnv,
    };

    const statusCode = status.status === 'healthy' 
      ? StatusCodes.OK 
      : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json(status);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Health check failed',
    });
  }
});

// API routes
const API_PREFIX = `${serverConfig.apiPrefix}/${serverConfig.apiVersion}`;

app.use(`${API_PREFIX}/ideas`, ideasRoutes);
app.use(`${API_PREFIX}/posts`, postsRoutes);
app.use(`${API_PREFIX}/publish`, publishRoutes);

// API info endpoint
app.get(serverConfig.apiPrefix, (_req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      name: 'PeakNorth Blog Automation API',
      version: serverConfig.apiVersion,
      environment: serverConfig.nodeEnv,
      endpoints: {
        health: '/health',
        ideas: `${API_PREFIX}/ideas`,
        posts: `${API_PREFIX}/posts`,
        publish: `${API_PREFIX}/publish`,
      },
      documentation: `${API_PREFIX}/docs`,
      features: {
        caching: featureFlagsConfig.enableCaching,
        rateLimiting: featureFlagsConfig.enableRateLimiting,
        requestLogging: featureFlagsConfig.enableRequestLogging,
        cors: featureFlagsConfig.enableCors,
      },
    },
    timestamp: Date.now(),
  };
  
  res.json(response);
});

// API documentation placeholder
app.get(`${API_PREFIX}/docs`, (req, res) => {
  res.json({
    success: true,
    message: 'PeakNorth Blog Automation API Documentation',
    data: {
      info: 'Complete API documentation for the PeakNorth Blog Automation System',
      version: serverConfig.apiVersion,
      baseUrl: `${req.protocol}://${req.get('host')}${API_PREFIX}`,
      
      // Ideas Management Endpoints
      ideas: {
        'POST /ideas': {
          description: 'Create a new blog idea',
          access: 'Public (with optional API key)',
          body: {
            topic: 'string (5-200 chars, required)',
            persona: 'string (3-100 chars, required)', 
            goal: 'string (10-500 chars, required)',
            targetAudience: 'string (optional, max 200 chars)',
            priority: 'enum: low|medium|high (default: medium)',
            difficulty: 'enum: beginner|intermediate|advanced (optional)',
            tags: 'array of strings (max 10, optional)',
            notes: 'string (optional, max 1000 chars)'
          }
        },
        'GET /ideas': {
          description: 'Get all blog ideas with filtering and pagination',
          access: 'Public (with optional API key)',
          queryParams: {
            page: 'number (default: 1)',
            limit: 'number (1-100, default: 20)',
            sortBy: 'enum: createdAt|updatedAt|priority|topic (default: createdAt)',
            sortOrder: 'enum: asc|desc (default: desc)',
            used: 'boolean (optional)',
            priority: 'enum: low|medium|high (optional)',
            category: 'string (optional)',
            search: 'string (optional)'
          }
        },
        'GET /ideas/pick': {
          description: 'Pick the next best idea for content creation (n8n workflow)',
          access: 'N8N only (requires API key)',
          response: 'Returns highest priority unused idea'
        },
        'GET /ideas/unused': {
          description: 'Get all unused ideas',
          access: 'Public (with optional API key)'
        },
        'GET /ideas/stats': {
          description: 'Get idea statistics (total, used, unused, by priority)',
          access: 'Public (with optional API key)'
        },
        'GET /ideas/:id': {
          description: 'Get a single idea by ID',
          access: 'Public (with optional API key)'
        },
        'PUT /ideas/:id': {
          description: 'Update an existing idea',
          access: 'Public (with optional API key)',
          body: 'Same as POST /ideas but all fields optional'
        },
        'POST /ideas/:id/use': {
          description: 'Mark an idea as used',
          access: 'N8N only (requires API key)'
        },
        'POST /ideas/:id/reset': {
          description: 'Reset an idea to unused state',
          access: 'Public (with optional API key)'
        },
        'DELETE /ideas/:id': {
          description: 'Delete an idea',
          access: 'Public (with optional API key)'
        }
      },

      // Posts Management Endpoints  
      posts: {
        'POST /posts': {
          description: 'Create a new blog post',
          access: 'N8N only (requires API key)',
          body: {
            status: 'enum: BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED (default: BRIEF)',
            brief: 'object with topic, persona, goal, targetAudience, keyPoints (optional)',
            scheduledAt: 'number (epoch timestamp, optional)',
            tags: 'array of strings (max 10, optional)',
            category: 'string (max 50 chars, optional)',
            featuredImage: 'BlogImage object (optional)',
            images: 'array of BlogImage objects (max 20, optional)'
          }
        },
        'GET /posts': {
          description: 'Get all blog posts with filtering and pagination',
          access: 'Public (with optional API key)',
          queryParams: {
            page: 'number (default: 1)',
            limit: 'number (1-100, default: 20)',
            sortBy: 'enum: createdAt|updatedAt|scheduledAt|publishedAt (default: createdAt)',
            sortOrder: 'enum: asc|desc (default: desc)',
            status: 'enum: BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED',
            category: 'string (optional)',
            authorId: 'string (optional)',
            search: 'string (optional)',
            dateFrom: 'ISO date string (optional)',
            dateTo: 'ISO date string (optional)'
          }
        },
        'GET /posts/stats': {
          description: 'Get post statistics by status',
          access: 'Public (with optional API key)'
        },
        'GET /posts/recent': {
          description: 'Get recent posts',
          access: 'Public (with optional API key)',
          queryParams: {
            limit: 'number (default: 10)'
          }
        },
        'GET /posts/:id': {
          description: 'Get a single post by ID',
          access: 'Public (with optional API key)'
        },
        'PUT /posts/:id': {
          description: 'Update an existing post',
          access: 'N8N and Admin',
          body: {
            status: 'enum (optional)',
            brief: 'PostBrief object (optional)',
            outline: 'PostOutline object (optional)',
            draft_mdx: 'string (500-50000 chars, optional)',
            seo: 'PostSEO object (optional)',
            scheduledAt: 'number (optional)',
            tags: 'array of strings (optional)',
            category: 'string (optional)',
            reviewNotes: 'string (max 1000 chars, optional)',
            featuredImage: 'BlogImage object (optional)',
            images: 'array of BlogImage objects (optional)'
          }
        },
        'POST /posts/:id/status': {
          description: 'Update post status with optional data patch',
          access: 'N8N and Admin',
          body: {
            status: 'enum (required)',
            patch: 'object with additional data (optional)',
            reviewNotes: 'string (max 1000 chars, optional)'
          }
        },
        'POST /posts/:id/publish': {
          description: 'Publish a post immediately',
          access: 'N8N and Admin',
          body: {
            htmlContent: 'string (optional)',
            publicUrl: 'URL string (optional)',
            slug: 'string (optional)',
            platforms: 'array of platform configs (optional)',
            scheduledAt: 'number (optional)'
          }
        },
        'DELETE /posts/:id': {
          description: 'Delete a post (only if not published)',
          access: 'Admin only'
        }
      },

      // Publishing Management Endpoints
      publish: {
        'GET /publish/ready': {
          description: 'Get posts ready to publish (for n8n workflow)',
          access: 'N8N only (requires API key)',
          response: 'Returns approved posts scheduled for current time or past'
        },
        'GET /publish/stats': {
          description: 'Get publishing statistics',
          access: 'Public (with optional API key)',
          response: 'Posts this week/month, average posts per week, next scheduled, recently published'
        },
        'GET /publish/schedule': {
          description: 'Get upcoming publishing schedule',
          access: 'Public (with optional API key)',
          queryParams: {
            limit: 'number (default: 10)'
          }
        },
        'POST /publish/batch': {
          description: 'Publish multiple posts at once',
          access: 'N8N only (requires API key)',
          body: {
            postIds: 'array of post IDs (required)'
          }
        },
        'POST /publish/webhook': {
          description: 'Webhook endpoint for external publishing platforms',
          access: 'N8N only (requires API key)',
          body: {
            postId: 'string (required)',
            status: 'PostStatus (optional)',
            publicUrl: 'string (optional)',
            error: 'string (optional)'
          }
        }
      },

      // System Endpoints
      system: {
        'GET /health': {
          description: 'Health check endpoint',
          access: 'Public',
          response: 'System health status including database connections'
        },
        'GET /api': {
          description: 'API information and feature flags',
          access: 'Public'
        },
        'GET /api/v1/docs': {
          description: 'This documentation endpoint',
          access: 'Public'
        }
      },

      // Authentication & Authorization
      authentication: {
        n8n: {
          header: 'x-api-key',
          description: 'Required for N8N-only endpoints',
          envVar: 'N8N_API_KEY'
        },
        admin: {
          header: 'x-api-key (optional)',
          description: 'Optional API key for admin operations and enhanced access'
        }
      },

      // Data Models
      models: {
        BlogIdea: {
          id: 'string',
          topic: 'string',
          persona: 'string', 
          goal: 'string',
          targetAudience: 'string (optional)',
          priority: 'enum: low|medium|high',
          difficulty: 'enum: beginner|intermediate|advanced (optional)',
          used: 'boolean',
          createdAt: 'number (epoch timestamp)',
          tags: 'array of strings (optional)',
          notes: 'string (optional)'
        },
        BlogPost: {
          id: 'string',
          status: 'enum: BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED',
          scheduledAt: 'number (epoch timestamp, nullable)',
          publishedAt: 'number (epoch timestamp, nullable)',
          createdAt: 'number (epoch timestamp)',
          updatedAt: 'number (epoch timestamp)',
          brief: 'PostBrief object (nullable)',
          outline: 'PostOutline object (nullable)',
          draft_mdx: 'string (nullable)',
          seo: 'PostSEO object (nullable)',
          featuredImage: 'BlogImage object (optional)',
          images: 'array of BlogImage objects (optional)',
          wordCount: 'number (optional)',
          estimatedReadTime: 'number (optional)',
          tags: 'array of strings (optional)',
          category: 'string (optional)',
          publicUrl: 'string (optional)',
          errorMessage: 'string (optional)'
        },
        PostBrief: {
          topic: 'string',
          persona: 'string',
          goal: 'string',
          targetAudience: 'string (optional)',
          keyPoints: 'array of strings (optional)'
        },
        PostOutline: {
          title: 'string',
          introduction: 'string',
          sections: 'array of {heading: string, subPoints: string[]}',
          conclusion: 'string',
          callToAction: 'string (optional)'
        },
        BlogImage: {
          url: 'string',
          storagePath: 'string',
          filename: 'string',
          size: 'number',
          alt: 'string (optional)',
          caption: 'string (optional)',
          width: 'number (optional)',
          height: 'number (optional)'
        }
      },

      // Response Format
      responseFormat: {
        success: {
          success: 'true',
          data: 'response data',
          message: 'success message (optional)',
          timestamp: 'number (epoch timestamp)'
        },
        error: {
          success: 'false',
          error: 'error message',
          timestamp: 'number (epoch timestamp)',
          data: 'error details object (optional)'
        }
      },

      // Rate Limiting & Features
      features: {
        caching: featureFlagsConfig.enableCaching,
        rateLimiting: featureFlagsConfig.enableRateLimiting,
        requestLogging: featureFlagsConfig.enableRequestLogging,
        cors: featureFlagsConfig.enableCors
      }
    },
    timestamp: Date.now(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Initialize database connections
    await databaseManager.initialize();
    
    // Start HTTP server
    const server = app.listen(serverConfig.port, () => {
      logger.info('🚀 Server started successfully!');
      logger.info(`📊 Environment: ${serverConfig.nodeEnv}`);
      logger.info(`🌐 Server: http://localhost:${serverConfig.port}`);
      logger.info(`💊 Health: http://localhost:${serverConfig.port}/health`);
      logger.info(`📖 API Docs: http://localhost:${serverConfig.port}${API_PREFIX}/docs`);
      logger.info(`🔥 Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
      
      const enabledFeatures = Object.entries(featureFlagsConfig)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature.replace('enable', '').toLowerCase());
      
      logger.info(`⚡ Features: ${enabledFeatures.join(', ')}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await databaseManager.disconnect();
          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
