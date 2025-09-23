import { Router } from 'express';
import { BlogPostService } from '../services/BlogPostService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateApiKey, optionalApiKey } from '../middleware/auth';
import { 
  createPostSchema, 
  updatePostSchema, 
  updatePostStatusSchema,
  publishPostSchema,
  postQuerySchema, 
  idParamSchema,
  validateSchema,
  validateQuery,
  validateParams
} from '../validators/blogValidators';
import { ApiResponse } from '../types/common';
import { PostStatus } from '../types/blog';
import logger from '../utils/logger';

const router = Router();

/**
 * @route   POST /api/posts
 * @desc    Create a new blog post
 * @access  N8N only (for workflow automation)
 */
router.post('/',
  authenticateApiKey,
  validateSchema(createPostSchema),
  asyncHandler(async (req, res) => {
    const post = await BlogPostService.createPost(req.body);
    console.log("create post", post)
    const response: ApiResponse = {
      success: true,
      data: post,
      message: 'Blog post created successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Blog post created via n8n API', { 
      postId: post.id, 
      status: post.status,
      topic: post.brief?.topic 
    });
    
    res.status(201).json(response);
  })
);

/**
 * @route   GET /api/posts
 * @desc    Get all blog posts with optional filtering
 * @access  Public (with optional API key)
 */
router.get('/',
  optionalApiKey,
  validateQuery(postQuerySchema),
  asyncHandler(async (req, res) => {
    const { 
      status, 
      category, 
      authorId, 
      search, 
      dateFrom, 
      dateTo 
    } = req.query;
    
    const filters = {
      status: status as PostStatus,
      category: category as string,
      search: search as string,
      dateFrom: dateFrom ? new Date(dateFrom as string).getTime() : undefined,
      dateTo: dateTo ? new Date(dateTo as string).getTime() : undefined,
    };
    
    const posts = await BlogPostService.getAllPosts(filters);
    
    const response: ApiResponse = {
      success: true,
      data: posts,
      timestamp: Date.now(),
    };
    
    logger.info('Blog posts retrieved via API', { 
      count: posts.length,
      filters,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   GET /api/posts/stats
 * @desc    Get post statistics
 * @access  Public (with optional API key)
 */
router.get('/stats',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const stats = await BlogPostService.getPostStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   GET /api/posts/recent
 * @desc    Get recent posts
 * @access  Public (with optional API key)
 */
router.get('/recent',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const posts = await BlogPostService.getRecentPosts(limit);
    
    const response: ApiResponse = {
      success: true,
      data: posts,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   GET /api/posts/:id
 * @desc    Get a single post by ID
 * @access  Public (with optional API key)
 */
router.get('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const post = await BlogPostService.getPostById(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      data: post,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);
// Important to look into
/**
 * @route   PUT /api/posts/:id
 * @desc    Update an existing post
 * @access  N8N and Admin
 */
router.put('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  validateSchema(updatePostSchema),
  asyncHandler(async (req, res) => {
    const post = await BlogPostService.updatePost(req.params.id, req.body);
    console.log(post)
    const response: ApiResponse = {
      success: true,
      data: post,
      message: 'Post updated successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Post updated via API', { 
      postId: post.id,
      updates: Object.keys(req.body),
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   POST /api/posts/:id/status
 * @desc    Update post status
 * @access  N8N and Admin
 */
router.post('/:id/status',
  optionalApiKey,
  validateParams(idParamSchema),
  validateSchema(updatePostStatusSchema),
  asyncHandler(async (req, res) => {
    const post = await BlogPostService.updatePostStatus(req.params.id, req.body);
    
    const response: ApiResponse = {
      success: true,
      data: post,
      message: 'Post status updated successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Post status updated via API', { 
      postId: post.id,
      newStatus: req.body.status,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   POST /api/posts/:id/publish
 * @desc    Publish a post immediately
 * @access  N8N and Admin
 */
router.post('/:id/publish',
  optionalApiKey,
  validateParams(idParamSchema),
  validateSchema(publishPostSchema),
  asyncHandler(async (req, res) => {
    const post = await BlogPostService.publishPost(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      data: post,
      message: 'Post published successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Post published via API', { 
      postId: post.id,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (only if not published)
 * @access  Admin only
 */
router.delete('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await BlogPostService.deletePost(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Post deleted successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Post deleted via API', { 
      postId: req.params.id,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

export default router;
