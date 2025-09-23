// Common types used across the application

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  services: {
    firebase: 'up' | 'down';
    cache: 'up' | 'down';
  };
  environment: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Firebase Firestore timestamp type
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// Generic filter interface
export interface FilterOptions {
  [key: string]: any;
}

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Email template data
export interface EmailTemplateData {
  [key: string]: any;
}

// File upload interface
export interface FileUpload {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Rate limit info
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}
