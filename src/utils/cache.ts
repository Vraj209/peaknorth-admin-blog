// In-memory cache implementation
// Simple cache utility for storing frequently accessed data

import logger from '../utils/logger';
import { CacheOptions } from '../types/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tags: string[];
  createdAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtl = 300; // 5 minutes in seconds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('In-memory cache initialized');
  }

  /**
   * Set a value in the cache
   */
  set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): void {
    const ttl = options.ttl || this.defaultTtl;
    const tags = options.tags || [];
    const expiresAt = Date.now() + (ttl * 1000);

    this.cache.set(key, {
      data: value,
      expiresAt,
      tags,
      createdAt: Date.now(),
    });

    logger.debug(`Cache SET: ${key}`, { ttl, tags });
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return entry.data;
  }

  /**
   * Delete a specific key from the cache
   */
  del(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Delete all keys with specific tags
   */
  delByTag(tag: string): number {
    let deletedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug(`Cache DELETE by tag: ${tag}`, { deletedCount });
    }

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache CLEAR: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;
    const tagCounts: Record<string, number> = {};

    for (const [_key, entry] of this.cache.entries()) {
      totalSize++;
      
      if (now > entry.expiresAt) {
        expiredCount++;
      }

      entry.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }

    return {
      totalEntries: totalSize,
      expiredEntries: expiredCount,
      activeEntries: totalSize - expiredCount,
      tagCounts,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cache cleanup: ${cleanedCount} expired entries removed`);
    }
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
    logger.info('Cache destroyed');
  }
}

// Export singleton instance
export const CacheManager = new InMemoryCache();

// Export utility functions
export const cache = {
  set: <T>(key: string, value: T, options?: CacheOptions) => 
    CacheManager.set(key, value, options),
  
  get: <T>(key: string): T | null => 
    CacheManager.get<T>(key),
  
  del: (key: string): boolean => 
    CacheManager.del(key),
  
  delByTag: (tag: string): number => 
    CacheManager.delByTag(tag),
  
  clear: (): void => 
    CacheManager.clear(),
  
  has: (key: string): boolean => 
    CacheManager.has(key),
  
  getOrSet: <T>(key: string, factory: () => Promise<T> | T, options?: CacheOptions): Promise<T> => 
    CacheManager.getOrSet(key, factory, options),
  
  getStats: () => 
    CacheManager.getStats(),
};

export default cache;
