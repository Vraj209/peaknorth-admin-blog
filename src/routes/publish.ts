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
  asyncHandler(async (_req, res) => {
    const approvedPosts = await BlogPostService.getReadyToPublishPosts();
    console.log("Posts Approved to seo:", approvedPosts);
    const response: ApiResponse = {
      success: true,
      data: approvedPosts,
      message: approvedPosts.length > 0 ? `Found ${approvedPosts.length} post(s) ready to publish`
        : 'No posts ready to publish',
      timestamp: Date.now(),
    };
    
    logger.info('Ready to publish posts retrieved via n8n API', { 
      post: approvedPosts,
      count: approvedPosts.length,
      postIds: approvedPosts.map(p => p.id)
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
  asyncHandler(async (req, res): Promise<void> => {
    const { postIds } = req.body;
    
    if (!Array.isArray(postIds) || postIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'postIds array is required',
        timestamp: Date.now(),
      });
      return;
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
    const approvedPosts = await BlogPostService.getPostsByStatus('SCHEDULED');
    
    // Filter and sort by scheduled time
    const scheduledPosts = approvedPosts.slice(0, limit);
    
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
  asyncHandler(async (req, res): Promise<void> => {
    const { postId, status, publicUrl, error } = req.body;
    
    if (!postId) {
      res.status(400).json({
        success: false,
        error: 'postId is required',
        timestamp: Date.now(),
      });
      return;
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
