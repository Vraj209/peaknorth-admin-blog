import { z } from 'zod';

// Enums
export enum PostStatus {
  BRIEF = 'BRIEF',
  OUTLINE = 'OUTLINE', 
  DRAFT = 'DRAFT',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  UNPUBLISHED = 'UNPUBLISHED',
  REGENRATE = 'REGENRATE'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

// Common validation schemas
const timestampSchema = z.number().int().positive();
const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');
const urlSchema = z.string().url();
const emailSchema = z.string().email();

// Image validation schemas
const blogImageSchema = z.object({
  url: urlSchema,
  storagePath: z.string().min(1, 'Storage path is required'),
  filename: z.string().min(1, 'Filename is required'),
  size: z.number().int().min(1, 'File size must be positive'),
  alt: z.string().max(200, 'Alt text must not exceed 200 characters').optional(),
  caption: z.string().max(500, 'Caption must not exceed 500 characters').optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

// Blog Idea validation schemas
export const createBlogIdeaSchema = z.object({
  topic: z.string()
    .min(5, 'Topic must be at least 5 characters long')
    .max(200, 'Topic must not exceed 200 characters')
    .trim(),
  persona: z.string()
    .min(3, 'Persona must be at least 3 characters long')
    .max(100, 'Persona must not exceed 100 characters')
    .trim(),
  goal: z.string()
    .min(10, 'Goal must be at least 10 characters long')
    .max(500, 'Goal must not exceed 500 characters')
    .trim(),
  targetAudience: z.string()
    .max(200, 'Target audience must not exceed 200 characters')
    .trim()
    .optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  tags: z.array(z.string().trim().min(1)).max(10, 'Maximum 10 tags allowed').default([]),
  estimatedWordCount: z.number().int().min(100).max(10000).optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  category: z.string().max(50).trim().optional(),
  keywords: z.array(z.string().trim().min(1)).max(20, 'Maximum 20 keywords allowed').default([]),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').trim().optional(),
});

export const updateBlogIdeaSchema = createBlogIdeaSchema.partial();

export const blogIdeaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'topic']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  used: z.coerce.boolean().optional(),
  priority: z.nativeEnum(Priority).optional(),
  category: z.string().optional(),
  search: z.string().trim().optional(),
});

// Blog Post validation schemas
const postBriefSchema = z.object({
  topic: z.string().min(5).max(200).trim(),
  persona: z.string().min(3).max(100).trim(),
  goal: z.string().min(10).max(500).trim(),
  targetAudience: z.string().max(200).trim().optional(),
  keyPoints: z.array(z.string().trim().min(1)).max(10).default([]),
  tone: z.string().max(50).trim().optional(),
  style: z.string().max(50).trim().optional(),
  callToAction: z.string().max(200).trim().optional(),
});

const outlineSectionSchema = z.object({
  heading: z.string().min(3).max(100).trim(),
  subPoints: z.array(z.string().trim().min(1)).min(1).max(10),
  estimatedWordCount: z.number().int().min(50).max(2000).optional(),
  keywords: z.array(z.string().trim().min(1)).max(10).default([]),
});

const postOutlineSchema = z.object({
  title: z.string().min(10).max(200).trim(),
  introduction: z.string().min(50).max(1000).trim(),
  sections: z.array(outlineSectionSchema).min(1).max(10),
  conclusion: z.string().min(50).max(1000).trim(),
  callToAction: z.string().min(10).max(200).trim(),
  estimatedWordCount: z.number().int().min(500).max(10000).optional(),
  keywords: z.array(z.string().trim().min(1)).max(20).default([]),
});

const postSEOSchema = z.object({
  metaTitle: z.string().min(30).max(60).trim(),
  metaDescription: z.string().min(120).max(160).trim(),
  focusKeyword: z.string().min(2).max(50).trim(),
  keywords: z.array(z.string().trim().min(1)).min(1).max(20),
  slug: slugSchema,
  // canonicalUrl: urlSchema.optional(),
  // ogTitle: z.string().max(60).trim().optional(),
  // ogDescription: z.string().max(160).trim().optional(),
  // ogImage: urlSchema.optional(),
  // twitterTitle: z.string().max(70).trim().optional(),
  // twitterDescription: z.string().max(200).trim().optional(),
  // twitterImage: urlSchema.optional(),
  // schema: z.record(z.any()).optional(),
});

const postDraftSchema = z.object({
  mdx: z.string().min(100, 'Draft content must be at least 100 characters').max(50000, 'Draft content must not exceed 50,000 characters'),
  wordCount: z.number().int().min(1, 'Word count must be positive'),
  estimatedReadTime: z.number().int().min(1, 'Estimated read time must be positive'),
});

export const createPostSchema = z.object({
  status: z.nativeEnum(PostStatus).default(PostStatus.BRIEF),
  brief: postBriefSchema.optional(),
  outline: postOutlineSchema.optional(),
  draft: postDraftSchema.optional(),
  seo: postSEOSchema.optional(),
  scheduledAt: timestampSchema.optional(),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  category: z.string().max(50).trim().optional(),
  ideaId: z.string().optional(),
  authorId: z.string().optional(),
  featuredImage: blogImageSchema.optional(),
  images: z.array(blogImageSchema).max(20, 'Maximum 20 images allowed').default([]),
  publicUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
  htmlContent: z.string().min(500).optional()
});

export const updatePostSchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  brief: postBriefSchema.optional(),
  outline: postOutlineSchema.optional(),
  draft: postDraftSchema.optional(),
  seo: postSEOSchema.optional(),
  scheduledAt: timestampSchema.optional(),
  tags: z.array(z.string().trim().min(1)).max(10).optional(),
  category: z.string().max(50).trim().optional(),
  ideaId: z.string().optional(),
  reviewNotes: z.string().max(1000).trim().optional(),
  featuredImage: blogImageSchema.nullable().optional(),
  images: z.array(blogImageSchema).max(20, 'Maximum 20 images allowed').optional(),
  htmlContent: z.string().min(500).optional()
});

export const updatePostStatusSchema = z.object({
  status: z.nativeEnum(PostStatus),
  patch: z.record(z.any()).optional(),
  reviewNotes: z.string().max(1000).trim().optional(),
});

export const publishPostSchema = z.object({
  htmlContent: z.string().min(500).optional(),
  publicUrl: urlSchema.optional(),
  slug: slugSchema.optional(),
  platforms: z.array(z.object({
    name: z.string(),
    enabled: z.boolean(),
    config: z.record(z.any()).optional(),
  })).optional(),
  scheduledAt: timestampSchema.optional(),
});

export const postQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'scheduledAt', 'publishedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.nativeEnum(PostStatus).optional(),
  category: z.string().optional(),
  authorId: z.string().optional(),
  search: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Publishing validation schemas
export const publishingStatsQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional(),
});

// Content generation validation schemas
export const generateContentSchema = z.object({
  type: z.enum(['outline', 'draft', 'seo', 'revision']),
  prompt: z.string().min(10).max(2000).trim(),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(4000).default(2000),
  context: z.record(z.any()).optional(),
});

// Image upload validation schemas
export const imageUploadSchema = z.object({
  type: z.enum(['featured', 'content', 'thumbnail']).default('content'),
  folder: z.string().max(100).default('blog-images'),
  alt: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
});

export const multipleImageUploadSchema = z.object({
  type: z.enum(['content', 'gallery']).default('content'),
  folder: z.string().max(100).default('blog-images'),
  maxFiles: z.number().int().min(1).max(20).default(5),
});

// Image management validation schemas
export const updateImageSchema = z.object({
  alt: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const deleteImageSchema = z.object({
  storagePath: z.string().min(1, 'Storage path is required'),
  removeFromPosts: z.boolean().default(true),
});

// Email validation schemas
export const emailNotificationSchema = z.object({
  to: z.union([emailSchema, z.array(emailSchema)]),
  subject: z.string().min(5).max(200).trim(),
  template: z.string().optional(),
  variables: z.record(z.any()).default({}),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  scheduledAt: timestampSchema.optional(),
});

// Webhook validation schemas
export const webhookPayloadSchema = z.object({
  event: z.string().min(3).max(100),
  data: z.record(z.any()),
  timestamp: timestampSchema,
  signature: z.string(),
});

// Search validation schemas
export const searchQuerySchema = z.object({
  query: z.string().min(1).max(200).trim(),
  type: z.enum(['posts', 'ideas', 'images', 'all']).default('all'),
  filters: z.record(z.any()).default({}),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Analytics validation schemas
export const analyticsQuerySchema = z.object({
  postId: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional(),
  metrics: z.array(z.string()).default(['views', 'uniqueViews', 'averageTimeOnPage']),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  type: z.enum(['image', 'document', 'media']),
  maxSize: z.number().int().min(1).max(10485760).default(5242880), // 5MB default
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'image/webp']),
});

// Batch operations validation schemas
export const batchOperationSchema = z.object({
  operation: z.enum(['update', 'delete', 'publish', 'archive']),
  ids: z.array(z.string()).min(1).max(100),
  data: z.record(z.any()).optional(),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Common query validation
export const commonQuerySchema = z.object({
  fields: z.string().optional(), // Comma-separated field names
  include: z.string().optional(), // Comma-separated related resources
  expand: z.string().optional(), // Comma-separated expandable fields
});

// Validation middleware helper
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: any, _res: any, next: any) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: any, _res: any, next: any) => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: any, _res: any, next: any) => {
    try {
      const validatedParams = schema.parse(req.params);
      req.params = validatedParams;
      next();
    } catch (error) {
      next(error);
    }
  };
};