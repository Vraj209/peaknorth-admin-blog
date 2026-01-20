import { db } from '../config/database';
import { 
  BlogPost, 
  PostStatus, 
  CreatePostRequest, 
  UpdatePostRequest, 
  UpdatePostStatusRequest,
  PostStats,
  PostFilters,
  PublishingStats,
  BlogIdea
} from '../types/blog';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import cache from '../utils/cache';
import { triggerRegenerateWebhook } from '../utils/n8nWebhook';
import { BlogIdeaService } from './BlogIdeaService';

export class BlogPostService {
  private static readonly COLLECTION = 'posts';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new blog post
   */
  static async createPost(postData: CreatePostRequest): Promise<BlogPost> {
    try {
      const post: BlogPost = {
        id: randomUUID(),
        status: 'BRIEF',
        scheduledAt: postData.scheduledAt || null,
        publishedAt: null,
        createdAt: new Date(Date.now()),
        updatedAt: new Date(Date.now()),
        brief: postData.brief || null,
        outline: postData.outline || null,
        draft: postData.draft || null,
        seo: postData.seo || null,
        ideaId: postData.ideaId || '',
        ...(postData.featuredImage && { featuredImage: postData.featuredImage }),
        ...(postData.images && { images: postData.images }),
        ...(postData.publicUrl && { publicUrl: postData.publicUrl }),
        ...(postData.errorMessage && { errorMessage: postData.errorMessage }),
        ...(postData.tags && { tags: postData.tags }),
        ...(postData.category && { category: postData.category }),
          
      };
      await db.collection(this.COLLECTION).doc(post.id).set(post);
      
      // Invalidate cache - delete all posts from cache
      cache.delByTag('posts');
      
      logger.info('Blog post created', { 
        postId: post.id, 
        ideaId: post.ideaId,
        status: post.status,
        topic: post.brief?.topic ,
        tags: post.tags,
        category: post.category,
        featuredImage: post.featuredImage,
        images: post.images,
        publicUrl: post.publicUrl,
        errorMessage: post.errorMessage,
      });
      
      return post;
    } catch (error) {
      logger.error('Failed to create blog post:', error);
      throw error;
    }
  }

  /**
   * Get all posts with optional filtering
   */
  static async getAllPosts(filters?: PostFilters): Promise<BlogPost[]> {
    try {
      const cacheKey = `posts:all:${JSON.stringify(filters || {})}`;
      const cached = cache.get<BlogPost[]>(cacheKey);
      if (cached) return cached;

      let query = db.collection(this.COLLECTION).orderBy('createdAt', 'desc');

      // Apply Firestore filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          // For multiple statuses, we'll filter client-side
        } else {
          query = query.where('status', '==', filters.status);
        }
      }

      if (filters?.dateFrom) {
        query = query.where('createdAt', '>=', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.where('createdAt', '<=', filters.dateTo);
      }

      const snapshot = await query.get();
      let posts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BlogPost));

      // Apply client-side filters
      if (filters?.status && Array.isArray(filters.status)) {
        posts = posts.filter(post => filters.status!.includes(post.status));
      }

      if (filters?.tags && filters.tags.length > 0) {
        posts = posts.filter(post => 
          post.tags?.some(tag => filters.tags!.includes(tag))
        );
      }

      if (filters?.category) {
        posts = posts.filter(post => post.category === filters.category);
      }

      if (filters?.hasErrors !== undefined) {
        posts = posts.filter(post => 
          filters.hasErrors ? !!post.errorMessage : !post.errorMessage
        );
      }

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        posts = posts.filter(post => 
          post.brief?.topic?.toLowerCase().includes(searchLower) ||
          post.outline?.title?.toLowerCase().includes(searchLower) ||
          post.draft?.mdx?.toLowerCase().includes(searchLower)
        );
      }

      cache.set(cacheKey, posts, { ttl: this.CACHE_TTL, tags: ['posts'] });
      return posts;
    } catch (error) {
      logger.error('Failed to get posts:', error);
      throw error;
    }
  }

  /**
   * Get a single post by ID
   */
  static async getPostById(postId: string): Promise<BlogPost> {
    try {
      logger.info('Fetching post by ID', { postId });
      
      const cacheKey = `post:${postId}`;
      const cached = cache.get<BlogPost>(cacheKey);
      if (cached) {
        logger.info('Post found in cache', { postId });
        return cached;
      }

      const postDoc = await db.collection(this.COLLECTION).doc(postId).get();
      
      if (!postDoc.exists) {
        logger.warn('Post not found in database', { postId, collection: this.COLLECTION });
        throw new NotFoundError(`Post with ID '${postId}' not found`);
      }

      const post = { ...postDoc.data(), id: postDoc.id } as BlogPost;
      cache.set(cacheKey, post, { ttl: this.CACHE_TTL, tags: ['posts'] });
      
      return post;
    } catch (error) {
      logger.error('Failed to get post by ID:', error);
      throw error;
    }
  }
  
  // based on post id get the idea
  static async getIdeaByPostId(postId: string): Promise<BlogIdea> {
      const postRef = db.collection(this.COLLECTION).doc(postId);
      const postDoc = await postRef.get();

      const ideaId = postDoc.data()?.ideaId as string;
      if (!ideaId) {
        throw new NotFoundError(`Post with ID '${postId}' has no idea ID`);
      }
      return await BlogIdeaService.getIdeaById(ideaId);
  }
  
  /**
   * Update an existing post
   */
  static async updatePost(postId: string, updates: UpdatePostRequest): Promise<BlogPost> {
    try {
      const postRef = db.collection(this.COLLECTION).doc(postId);
      const postDoc = await postRef.get();
      const idea = await this.getIdeaByPostId(postId);

      if (!postDoc.exists) {
        throw new NotFoundError(`Post with ID '${postId}' not found`);
      }

      const currentPost = { ...postDoc.data(), id: postDoc.id } as BlogPost;

      // Validate status transition if status is being updated
      if (updates.status && updates.status !== currentPost.status) {
        this.validateStatusTransition(currentPost.status, updates.status);
      }

      const updateData: any = {
        ...updates,
        updatedAt: Date.now(),
      };

      await postRef.update(updateData);

      // Auto-update status based on content updates
      if (updates.outline && currentPost.status === 'BRIEF') {
        await postRef.update({ status: 'OUTLINE' });
        await BlogIdeaService.updateIdea(idea.id, { isBriefCreated: true });
        logger.info('Auto-updated post status to OUTLINE', { postId });
      } 
      // else if (updates.draft?.mdx && currentPost.status === 'OUTLINE') {
      //   await postRef.update({ status: 'DRAFT' });
      //   logger.info('Auto-updated post status to DRAFT', { postId });
      // } 
    

      // Get updated post
      const updatedDoc = await postRef.get();
      const updatedPost = { ...updatedDoc.data(), id: updatedDoc.id } as BlogPost;

      // Invalidate cache
      cache.delByTag('posts');
      cache.del(`post:${postId}`);

      if (updatedPost.status === 'PUBLISHED') {
        await BlogIdeaService.updateIdeaStatus(idea.id, "USED");
        logger.info('Updated idea status to USED', { ideaId: idea.id, postId });
      }
      
      // Trigger N8N webhook when status is set to REGENRATE
      if (updates.status === 'REGENRATE') {
        triggerRegenerateWebhook(updatedPost).catch((error) => {
          logger.error('Failed to trigger regenerate webhook from updatePost', { 
            postId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });
      }
      
      logger.info('Post updated', { postId, updates: Object.keys(updateData) });
      return updatedPost;
    } catch (error) {
      logger.error('Failed to update post:', error);
      throw error;
    }
  }

  /**
   * Update post status with validation
   */
  static async updatePostStatus(
    postId: string, 
    statusUpdate: UpdatePostStatusRequest
  ): Promise<BlogPost> {
    try {
      logger.info('Updating post status', { postId, statusUpdate });
      
      const post = await this.getPostById(postId);
      const { status, scheduledAt, errorMessage } = statusUpdate;

      // Validate status transitions
      this.validateStatusTransition(post.status, status);

      const updateData: any = {
        status,
        updatedAt: Date.now(),
      };

      if (scheduledAt !== null) {
        updateData.scheduledAt = new Date(scheduledAt!).getTime();
      }

      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      }

      // Set publishedAt when status becomes PUBLISHED
      if (status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
        updateData.publishedAt = new Date(Date.now()).getTime();
        
        // Mark the associated idea as used
        if (post.ideaId) {
          try {
            const { BlogIdeaService } = require('./BlogIdeaService');
            await BlogIdeaService.markIdeaAsUsed(post.ideaId);
            logger.info('Marked idea as used', { ideaId: post.ideaId, postId });
          } catch (error) {
            logger.error('Failed to mark idea as used', { ideaId: post.ideaId, error });
            // Don't fail the post update if idea marking fails
          }
        }
      }

      const updatedPost = await this.updatePost(postId, updateData);
      // Note: N8N webhook for REGENRATE is triggered in updatePost() method
      
      logger.info('Post status updated', { 
        postId, 
        fromStatus: post.status, 
        toStatus: status 
      });
      
      return updatedPost;
    } catch (error) {
      logger.error('Failed to update post status:', error);
      throw error;
    }
  }

  /**
   * Get posts by status
   */
  static async getPostsByStatus(status: PostStatus): Promise<BlogPost[]> {
    return this.getAllPosts({ status });
  }

  /**
   * Get posts ready for publishing (for n8n workflow)
   */
  static async getReadyToPublishPosts(): Promise<BlogPost[]> {
    try {
  
      const approvedPosts = await this.getPostsByStatus('APPROVED');
      logger.info(`Found ${approvedPosts.length} approved posts`);
      // const now = Date.now();
      // const readyPosts = approvedPosts.filter(post => 
      //   post.scheduledAt && post.scheduledAt?.getTime?.() <= now
      // );
      logger.info(`Found ${approvedPosts.length} posts ready to publish`);
      return approvedPosts;
    } catch (error) {
      logger.error('Failed to get ready to publish posts:', error);
      throw error;
    }
  }

  /**
   * Publish a post immediately
   */
  static async publishPost(postId: string): Promise<BlogPost> {
    try {
      const post = await this.getPostById(postId);
      const idea = await this.getIdeaByPostId(postId);

      if (post.status !== 'APPROVED' && post.status !== 'SCHEDULED') {
        throw new ValidationError('Only approved or scheduled posts can be published');
      }
      await BlogIdeaService.updateIdea(idea.id, { status: 'USED' });
      return await this.updatePostStatus(postId, { 
        status: 'PUBLISHED',
        scheduledAt: new Date(Date.now())
      });
    } catch (error) {
      logger.error('Failed to publish post:', error);
      throw error;
    }
  }

  /**
   * Get post statistics
   */
  static async getPostStats(): Promise<PostStats> {
    try {
      const cacheKey = 'posts:stats';
      const cached = cache.get<PostStats>(cacheKey);
      if (cached) return cached;

      const allPosts = await this.getAllPosts();
      
      const stats: PostStats = {
        total: allPosts.length,
        published: allPosts.filter(p => p.status === 'PUBLISHED').length,
        scheduled: allPosts.filter(p => p.status === 'APPROVED' || p.status === 'SCHEDULED').length,
        needsReview: allPosts.filter(p => p.status === 'NEEDS_REVIEW').length,
        drafts: allPosts.filter(p => p.status === 'DRAFT').length,
        approved: allPosts.filter(p => p.status === 'APPROVED').length,
        byStatus: {
          BRIEF: allPosts.filter(p => p.status === 'BRIEF').length,
          OUTLINE: allPosts.filter(p => p.status === 'OUTLINE').length,
          DRAFT: allPosts.filter(p => p.status === 'DRAFT').length,
          NEEDS_REVIEW: allPosts.filter(p => p.status === 'NEEDS_REVIEW').length,
          APPROVED: allPosts.filter(p => p.status === 'APPROVED').length,
          SCHEDULED: allPosts.filter(p => p.status === 'SCHEDULED').length,
          PUBLISHED: allPosts.filter(p => p.status === 'PUBLISHED').length,
          REGENRATE: allPosts.filter(p => p.status === 'REGENRATE').length,
        },
      };

      cache.set(cacheKey, stats, { ttl: this.CACHE_TTL, tags: ['posts'] });
      return stats;
    } catch (error) {
      logger.error('Failed to get post stats:', error);
      throw error;
    }
  }

  /**
   * Get publishing statistics
   */
  static async getPublishingStats(): Promise<PublishingStats> {
    try {
      const cacheKey = 'posts:publishing-stats';
      const cached = cache.get<PublishingStats>(cacheKey);
      if (cached) return cached;

      const now = Date.now();
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

      const publishedPosts = await this.getPostsByStatus('PUBLISHED');
      const approvedPosts = await this.getPostsByStatus('APPROVED');

      const postsThisWeek = publishedPosts.filter(p => 
        p.publishedAt && p.publishedAt?.getTime?.() >= oneWeekAgo
      ).length;

      const postsThisMonth = publishedPosts.filter(p => 
        p.publishedAt && p.publishedAt?.getTime?.() >= oneMonthAgo
      ).length;

      // Find next scheduled post
      const nextScheduled = approvedPosts
        .filter(p => p.scheduledAt && p.scheduledAt?.getTime?.() > now)
        .sort((a, b) => (a.scheduledAt?.getTime?.() || 0) - (b.scheduledAt?.getTime?.() || 0))[0];

      // Get recently published posts
      const recentlyPublished = publishedPosts
        .sort((a, b) => (b.publishedAt?.getTime?.() || 0) - (a.publishedAt?.getTime?.() || 0))
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          publishedAt: p.publishedAt!,
          ...(p.outline?.title && { title: p.outline?.title }),
          ...(p.publicUrl && { publicUrl: p.publicUrl }),
        }));

      const stats: PublishingStats = {
        postsThisWeek,
        postsThisMonth,
        avgPostsPerWeek: postsThisMonth / 4, // Rough estimate
        ...(nextScheduled && {
          nextScheduledPost: {
            id: nextScheduled.id,
            ...(nextScheduled.outline?.title && { title: nextScheduled.outline.title }),
            scheduledAt: nextScheduled.scheduledAt?.getTime?.() ?? 0,
          }
        }),
        recentlyPublished: recentlyPublished.map(p => ({
          id: p.id,
          publishedAt: p.publishedAt?.getTime?.() ?? 0,
          ...(p.title && { title: p.title }),
          ...(p.publicUrl && { publicUrl: p.publicUrl }),
        })),
      };

      cache.set(cacheKey, stats, { ttl: this.CACHE_TTL, tags: ['posts'] });
      return stats;
    } catch (error) {
      logger.error('Failed to get publishing stats:', error);
      throw error;
    }
  }

  /**
   * Delete a post (only if not published)
   */
  static async deletePost(postId: string): Promise<void> {
    try {
      const post = await this.getPostById(postId);

      if (post.status === 'PUBLISHED') {
        throw new ValidationError('Cannot delete a published post');
      }

      await db.collection(this.COLLECTION).doc(postId).delete();

      // Invalidate cache
      cache.delByTag('posts');
      cache.del(`post:${postId}`);
      
      logger.info('Post deleted', { postId, status: post.status });
    } catch (error) {
      logger.error('Failed to delete post:', error);
      throw error;
    }
  }

  /**
   * Validate status transitions
   */
  private static validateStatusTransition(currentStatus: PostStatus, newStatus: PostStatus): void {
    const validTransitions: Record<PostStatus, PostStatus[]> = {
      BRIEF: ['OUTLINE', 'DRAFT', 'REGENRATE'],
      OUTLINE: ['DRAFT', 'BRIEF', 'REGENRATE','NEEDS_REVIEW'],
      DRAFT: ['NEEDS_REVIEW', 'OUTLINE', 'REGENRATE'],
      NEEDS_REVIEW: ['APPROVED', 'DRAFT', 'REGENRATE'],
      APPROVED: ['SCHEDULED', 'PUBLISHED', 'DRAFT', 'REGENRATE'],
      SCHEDULED: ['PUBLISHED', 'APPROVED', 'REGENRATE'],
      PUBLISHED: ['PUBLISHED', 'REGENRATE'], // Published posts can only be republished or regenerated
      REGENRATE: ['BRIEF', 'OUTLINE', 'DRAFT', 'NEEDS_REVIEW'], // Regenerated posts can go back to earlier stages
    };

    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Get recent posts
   */
  static async getRecentPosts(limit: number = 10): Promise<BlogPost[]> {
    try {
      const allPosts = await this.getAllPosts();
      return allPosts.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent posts:', error);
      throw error;
    }
  }
}
