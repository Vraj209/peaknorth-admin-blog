import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables
config();

// Server configuration schema
const serverConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  apiVersion: z.string().default('v1'),
  apiPrefix: z.string().default('/api'),
});

// Firebase configuration schema
const firebaseConfigSchema = z.object({
  projectId: z.string().min(1, 'Firebase project ID is required'),
  databaseURL: z.string().url().optional(),
  storageBucket: z.string().optional(),
  serviceAccountKey: z.string().optional(),
});

// Security configuration schema
const securityConfigSchema = z.object({
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  jwtExpiresIn: z.string().default('7d'),
  jwtRefreshExpiresIn: z.string().default('30d'),
  n8nApiKey: z.string().min(16, 'N8N API key must be at least 16 characters'),
  n8nRegenerateWebhookUrl: z.string().url().optional(), // N8N webhook URL for post regeneration
  rateLimitWindowMs: z.coerce.number().default(900000), // 15 minutes
  rateLimitMaxRequests: z.coerce.number().default(100),
});

// External services configuration schema
const externalServicesSchema = z.object({
  openai: z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4o-mini'),
    maxTokens: z.coerce.number().default(4000),
  }),
  smtp: z.object({
    host: z.string().default('smtp.gmail.com'),
    port: z.coerce.number().default(587),
    secure: z.coerce.boolean().default(false),
    user: z.string().email('Valid email required for SMTP user'),
    pass: z.string().min(1, 'SMTP password is required'),
    from: z.string().email('Valid email required for sender'),
  }),
});

// URLs configuration schema
const urlsConfigSchema = z.object({
  frontend: z.string().url('Valid frontend URL required'),
  adminDashboard: z.string().url('Valid admin dashboard URL required'),
  publicBlog: z.string().url('Valid public blog URL required'),
});

// Logging configuration schema
const loggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  format: z.string().default('combined'),
  filePath: z.string().default('logs/app.log'),
});

// Feature flags schema
const featureFlagsSchema = z.object({
  enableCaching: z.coerce.boolean().default(true),
  enableRateLimiting: z.coerce.boolean().default(true),
  enableRequestLogging: z.coerce.boolean().default(true),
  enableCors: z.coerce.boolean().default(true),
});

// Monitoring configuration schema
const monitoringConfigSchema = z.object({
  sentryDsn: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
});

// Development configuration schema
const developmentConfigSchema = z.object({
  debug: z.string().default('peaknorth:*'),
  mockExternalServices: z.coerce.boolean().default(false),
});

// Parse and validate environment variables
const serverConfig = serverConfigSchema.parse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  apiVersion: process.env.API_VERSION,
  apiPrefix: process.env.API_PREFIX,
});

const firebaseConfig = firebaseConfigSchema.parse({
  projectId: process.env.FIREBASE_PROJECT_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
});

const securityConfig = securityConfigSchema.parse({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  n8nApiKey: process.env.N8N_API_KEY,
  n8nRegenerateWebhookUrl: process.env.N8N_REGENERATE_WEBHOOK_URL,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
});

const externalServicesConfig = externalServicesSchema.parse({
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    maxTokens: process.env.OPENAI_MAX_TOKENS,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
  },
});

const urlsConfig = urlsConfigSchema.parse({
  frontend: process.env.FRONTEND_URL,
  adminDashboard: process.env.ADMIN_DASHBOARD_URL,
  publicBlog: process.env.PUBLIC_BLOG_URL,
});

const loggingConfig = loggingConfigSchema.parse({
  level: process.env.LOG_LEVEL,
  format: process.env.LOG_FORMAT,
  filePath: process.env.LOG_FILE_PATH,
});

const featureFlagsConfig = featureFlagsSchema.parse({
  enableCaching: process.env.ENABLE_CACHING,
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING,
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING,
  enableCors: process.env.ENABLE_CORS,
});

const monitoringConfig = monitoringConfigSchema.parse({
  sentryDsn: process.env.SENTRY_DSN,
  googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
});

const developmentConfig = developmentConfigSchema.parse({
  debug: process.env.DEBUG,
  mockExternalServices: process.env.MOCK_EXTERNAL_SERVICES,
});

// Export configurations
export {
  serverConfig,
  firebaseConfig,
  securityConfig,
  externalServicesConfig,
  urlsConfig,
  loggingConfig,
  featureFlagsConfig,
  monitoringConfig,
  developmentConfig,
};

// Combined database config for backward compatibility
export const databaseConfig = {
  firebase: firebaseConfig,
};

// Environment helpers
export const isDevelopment = serverConfig.nodeEnv === 'development';
export const isProduction = serverConfig.nodeEnv === 'production';
export const isTest = serverConfig.nodeEnv === 'test';
