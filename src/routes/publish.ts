import { Router } from 'express';
import { BlogPostService } from '../services/BlogPostService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateApiKey, optionalApiKey } from '../middleware/auth';
import { ApiResponse } from '../types/common';
import logger from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/publish/ready
 * @desc    Get posts ready to publish (for n8n workflow)
 * @access  N8N only
 */
router.get('/ready',
  authenticateApiKey,
  asyncHandler(async (req, res) => {
    const posts = await BlogPostService.getReadyToPublishPosts();
    
    const response: ApiResponse = {
      success: true,
      data: posts,
      message: posts.length > 0 
        ? `Found ${posts.length} post(s) ready to publish`
        : 'No posts ready to publish',
      timestamp: Date.now(),
    };
    
    logger.info('Ready to publish posts retrieved via n8n API', { 
      count: posts.length,
      postIds: posts.map(p => p.id)
    });
    
    res.json(response);
  })
);

/**
 * @route   GET /api/publish/stats
 * @desc    Get publishing statistics
 * @access  Public (with optional API key)
 */
router.get('/stats',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const stats = await BlogPostService.getPublishingStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: Date.now(),
    };
    
    logger.info('Publishing stats retrieved via API', {
      postsThisWeek: stats.postsThisWeek,
      postsThisMonth: stats.postsThisMonth,
      isN8nRequest: req.isN8nRequest
    });
    
    res.json(response);
  })
);

/**
 * @route   POST /api/publish/batch
 * @desc    Publish multiple posts at once
 * @access  N8N only
 */
router.post('/batch',
  authenticateApiKey,
  asyncHandler(async (req, res) => {
    const { postIds } = req.body;
    
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'postIds array is required',
        timestamp: Date.now(),
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const postId of postIds) {
      try {
        const post = await BlogPostService.publishPost(postId);
        results.push({
          postId,
          success: true,
          post,
        });
      } catch (error) {
        errors.push({
          postId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const response: ApiResponse = {
      success: errors.length === 0,
      data: {
        published: results,
        errors,
        summary: {
          total: postIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
      message: `Batch publish completed: ${results.length} successful, ${errors.length} failed`,
      timestamp: Date.now(),
    };
    
    logger.info('Batch publish completed via n8n API', {
      total: postIds.length,
      successful: results.length,
      failed: errors.length,
      postIds,
    });
    
    res.json(response);
  })
);

/**
 * @route   GET /api/publish/schedule
 * @desc    Get upcoming publishing schedule
 * @access  Public (with optional API key)
 */
router.get('/schedule',
  optionalApiKey,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const approvedPosts = await BlogPostService.getPostsByStatus('APPROVED');
    
    // Filter and sort by scheduled time
    const scheduledPosts = approvedPosts
      .filter(post => post.scheduledAt && post.scheduledAt > Date.now())
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0))
      .slice(0, limit)
      .map(post => ({
        id: post.id,
        title: post.outline?.title || post.brief?.topic || 'Untitled',
        scheduledAt: post.scheduledAt,
        status: post.status,
        wordCount: post.wordCount,
        category: post.category,
        tags: post.tags,
      }));
    
    const response: ApiResponse = {
      success: true,
      data: scheduledPosts,
      timestamp: Date.now(),
    };
    
    res.json(response);
  })
);

/**
 * @route   POST /api/publish/webhook
 * @desc    Webhook endpoint for external publishing platforms
 * @access  N8N only
 */
router.post('/webhook',
  authenticateApiKey,
  asyncHandler(async (req, res) => {
    const { postId, status, publicUrl, error } = req.body;
    
    if (!postId) {
      return res.status(400).json({
        success: false,
        error: 'postId is required',
        timestamp: Date.now(),
      });
    }
    
    try {
      // Update post based on webhook data
      const updateData: any = {};
      
      if (status) {
        updateData.status = status;
      }
      
      if (publicUrl) {
        updateData.publicUrl = publicUrl;
      }
      
      if (error) {
        updateData.errorMessage = error;
      }
      
      if (status === 'PUBLISHED') {
        updateData.publishedAt = Date.now();
      }
      
      const post = await BlogPostService.updatePost(postId, updateData);
      
      const response: ApiResponse = {
        success: true,
        data: post,
        message: 'Post updated via webhook',
        timestamp: Date.now(),
      };
      
      logger.info('Post updated via webhook', {
        postId,
        status,
        publicUrl,
        error,
      });
      
      res.json(response);
    } catch (error) {
      logger.error('Webhook processing failed:', error);
      throw error;
    }
  })
);

export default router;
