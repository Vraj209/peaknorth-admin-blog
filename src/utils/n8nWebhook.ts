import { securityConfig } from '../config/environment';
import logger from './logger';
import { BlogPost } from '../types/blog';

export interface N8NWebhookPayload {
  event: 'post.regenerate' | 'post.created' | 'post.approved' | 'post.published';
  postId: string;
  post: BlogPost;
  timestamp: number;
}

/**
 * Trigger N8N webhook for post regeneration
 * This is called when a post status is set to REGENRATE
 */
export async function triggerRegenerateWebhook(post: BlogPost): Promise<boolean> {
  const webhookUrl = securityConfig.n8nRegenerateWebhookUrl;

  if (!webhookUrl) {
    logger.warn('N8N regenerate webhook URL not configured, skipping webhook trigger', {
      postId: post.id,
    });
    return false;
  }

  const payload: N8NWebhookPayload = {
    event: 'post.regenerate',
    postId: post.id,
    post: post,
    timestamp: Date.now(),
  };

  try {
    logger.info('Triggering N8N regenerate webhook', {
      postId: post.id,
      webhookUrl: webhookUrl.substring(0, 50) + '...', // Log partial URL for security
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': securityConfig.n8nApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('N8N webhook request failed', {
        postId: post.id,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return false;
    }

    logger.info('N8N regenerate webhook triggered successfully', {
      postId: post.id,
      status: response.status,
    });

    return true;
  } catch (error) {
    logger.error('Failed to trigger N8N regenerate webhook', {
      postId: post.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

