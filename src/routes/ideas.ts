import { Router } from 'express';
import { BlogIdeaService } from '../services/BlogIdeaService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateApiKey, optionalApiKey } from '../middleware/auth';
import { 
  createBlogIdeaSchema, 
  updateBlogIdeaSchema, 
  blogIdeaQuerySchema, 
  idParamSchema,
  validateSchema,
  validateQuery,
  validateParams
} from '../validators/blogValidators';
import { ApiResponse } from '../types/common';
import logger from '../utils/logger';

const router = Router();

/**
 * @route   POST /api/ideas
 * @desc    Create a new blog idea
 * @access  Public (with optional API key)
 */
router.post('/',
  optionalApiKey,
  validateSchema(createBlogIdeaSchema),
  asyncHandler(async (req, res) => {
    const idea = await BlogIdeaService.createIdea(req.body);
    
    const response: ApiResponse = {
      success: true,
      data: idea,
      message: 'Blog idea created successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Blog idea created via API', { 
      ideaId: idea.id, 
      topic: idea.topic,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.status(201).json(response);
  })
);

/**
 * @route   GET /api/ideas
 * @desc    Get all blog ideas with optional filtering
 * @access  Public (with optional API key)
 */

router.get('/',
  optionalApiKey,
  validateQuery(blogIdeaQuerySchema),
  asyncHandler(async (req, res) => {
    const { used, priority, category, search } = req.query;
    
    const filters = {
      used: used !== undefined ? Boolean(used) : undefined,
      priority: priority ? [priority].flat() : undefined,
      tags: category ? [category] : undefined,
      search: search as string,
    };
    
    const ideas = await BlogIdeaService.getAllIdeas(filters);
    
    const response: ApiResponse = {
      success: true,
      data: ideas,
      timestamp: Date.now(),
    };
    
    logger.info('Blog ideas retrieved via API', { 
      count: ideas.length,
      filters,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   GET /api/ideas/pick
 * @desc    Pick the next best idea for content creation (n8n workflow)
 * @access  N8N only
 */
router.get('/pick',
  authenticateApiKey,
  asyncHandler(async (req, res) => {
    const idea = await BlogIdeaService.pickNextIdea();
    
    if (!idea) {
      const response: ApiResponse = {
        success: false,
        error: 'No unused ideas available',
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
      data: idea,
      message: 'Idea picked for content creation',
      timestamp: Date.now(),
    };
    
    logger.info('Idea picked via n8n API', { 
      ideaId: idea.id, 
      topic: idea.topic,
      priority: idea.priority 
    });
    
    res.json(response);
  })
);

/**
 * @route   GET /api/ideas/unused
 * @desc    Get all unused ideas
 * @access  Public (with optional API key)
 */
router.get('/unused',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const ideas = await BlogIdeaService.getUnusedIdeas();
    
    const response: ApiResponse = {
      success: true,
      data: ideas,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   GET /api/ideas/stats
 * @desc    Get idea statistics
 * @access  Public (with optional API key)
 */
router.get('/stats',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const stats = await BlogIdeaService.getIdeaStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   GET /api/ideas/:id
 * @desc    Get a single idea by ID
 * @access  Public (with optional API key)
 */
router.get('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const idea = await BlogIdeaService.getIdeaById(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      data: idea,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   PUT /api/ideas/:id
 * @desc    Update an existing idea
 * @access  Public (with optional API key)
 */
router.put('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  validateSchema(updateBlogIdeaSchema),
  asyncHandler(async (req, res) => {
    const idea = await BlogIdeaService.updateIdea(req.params.id, req.body);
    
    const response: ApiResponse = {
      success: true,
      data: idea,
      message: 'Idea updated successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Idea updated via API', { 
      ideaId: idea.id,
      updates: Object.keys(req.body),
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   POST /api/ideas/:id/use
 * @desc    Mark an idea as used
 * @access  N8N only
 */
router.post('/:id/use',
  authenticateApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await BlogIdeaService.markIdeaAsUsed(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Idea marked as used',
      timestamp: Date.now(),
    };
    
    logger.info('Idea marked as used via n8n API', { ideaId: req.params.id });
    
    res.json(response);
  })
);

/**
 * @route   POST /api/ideas/:id/reset
 * @desc    Reset an idea to unused state
 * @access  Public (with optional API key)
 */
router.post('/:id/reset',
  optionalApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await BlogIdeaService.resetIdea(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Idea reset to unused state',
      timestamp: Date.now(),
    };
    
    logger.info('Idea reset via API', { 
      ideaId: req.params.id,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

/**
 * @route   DELETE /api/ideas/:id
 * @desc    Delete an idea
 * @access  Public (with optional API key)
 */
router.delete('/:id',
  optionalApiKey,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await BlogIdeaService.deleteIdea(req.params.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Idea deleted successfully',
      timestamp: Date.now(),
    };
    
    logger.info('Idea deleted via API', { 
      ideaId: req.params.id,
      isN8nRequest: req.isN8nRequest 
    });
    
    res.json(response);
  })
);

export default router;
