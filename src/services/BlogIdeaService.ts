import { db } from "../config/database";
import {
  BlogIdea,
  CreateIdeaRequest,
  UpdateIdeaRequest,
  IdeaStats,
  Priority,
  IdeaStatus,
} from "../types/blog";
import { NotFoundError, ValidationError } from "../middleware/errorHandler";
import { randomUUID } from "crypto";
import logger from "../utils/logger";
import cache from "../utils/cache";


export class BlogIdeaService {
  private static readonly COLLECTION = "ideas";
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new blog idea
   */
  static async createIdea(ideaData: CreateIdeaRequest): Promise<BlogIdea> {
    try {
      const idea: BlogIdea = {
        id: randomUUID(),
        topic: ideaData.topic.trim(),
        persona: ideaData.persona.trim(),
        goal: ideaData.goal.trim(),
        targetAudience: ideaData.targetAudience?.trim() || "",
        priority: ideaData.priority,
        status: ideaData.status,
        createdAt: new Date(Date.now()),
        tags: ideaData.tags?.map((tag) => tag.trim().toLowerCase()) || [],
        ...(ideaData.difficulty && { difficulty: ideaData.difficulty }),
        ...(ideaData.notes?.trim() && { notes: ideaData.notes.trim() }),
      };

      await db.collection(this.COLLECTION).doc(idea.id).set(idea);

      // Invalidate cache
      cache.delByTag("ideas");

      logger.info("Blog idea created", { ideaId: idea.id, topic: idea.topic });
      return idea;
    } catch (error) {
      logger.error("Failed to create blog idea:", error);
      throw error;
    }
  }

  /**
   * Get all ideas with optional filtering
   */
  static async getAllIdeas(filters?: {
    status?: IdeaStatus;
    priority?: Priority[];
    tags?: string[];
    search?: string;
  }): Promise<BlogIdea[]> {
    try {
      const cacheKey = `ideas:all:${JSON.stringify(filters || {})}`;
      const cached = cache.get<BlogIdea[]>(cacheKey);
      if (cached) return cached;

      let query = db.collection(this.COLLECTION).orderBy("createdAt", "desc");

      

      const snapshot = await query.get();
      let ideas = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as BlogIdea)
      );

      // Apply client-side filters (Firestore limitations)
      if (filters?.priority && filters.priority.length > 0) {
        ideas = ideas.filter((idea) =>
          filters.priority!.includes(idea.priority)
        );
      }

      if (filters?.tags && filters.tags.length > 0) {
        ideas = ideas.filter((idea) =>
          idea.tags?.some((tag) => filters.tags!.includes(tag.toLowerCase()))
        );
      }

      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        ideas = ideas.filter(
          (idea) =>
            idea.topic.toLowerCase().includes(searchLower) ||
            idea.goal.toLowerCase().includes(searchLower) ||
            idea.persona.toLowerCase().includes(searchLower)
        );
      }

      cache.set(cacheKey, ideas, { ttl: this.CACHE_TTL, tags: ["ideas"] });
      return ideas;
    } catch (error) {
      logger.error("Failed to get ideas:", error);
      throw error;
    }
  }

  /**
   * Get unused ideas sorted by priority
   */
  static async getUnusedIdeas(): Promise<BlogIdea[]> {
    return await this.getAllIdeas({ status: "UNUSED" });
  }

  /**
   * Pick the next best idea for content creation (n8n workflow)
   */
  static async pickNextIdea(): Promise<BlogIdea | null> {
    try {
      const unusedIdeas = await this.getUnusedIdeas();

      if (unusedIdeas.length === 0) {
        logger.warn("No unused ideas available for picking");
        return null;
      }

      // Sort by priority: high -> medium -> low, then by creation date
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      unusedIdeas.sort((a, b) => {
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt?.getTime?.() - b.createdAt?.getTime?.(); // Older first
      });

      const selectedIdea = unusedIdeas[0];
      if (!selectedIdea) {
        return null;
      }

      await this.updateIdeaStatus(selectedIdea.id, "PROCESSING");

      logger.info("Idea picked for content creation", {
        ideaId: selectedIdea.id,
        topic: selectedIdea.topic,
        priority: selectedIdea.priority,
      });

      return selectedIdea;
    } catch (error) {
      logger.error("Failed to pick next idea:", error);
      throw error;
    }
  }

  /**
   * Mark an idea as used
   */
  static async markIdeaAsUsed(ideaId: string): Promise<void> {
    try {
      const ideaRef = db.collection(this.COLLECTION).doc(ideaId);
      const ideaDoc = await ideaRef.get();
      if (!ideaDoc.exists) throw new NotFoundError("Idea");
      const ideaData = ideaDoc.data() as BlogIdea;
      if (ideaData.status === "USED") throw new ValidationError("Idea is already used");
      if (ideaData.status === "PROCESSING") throw new ValidationError("Idea is already processing");
      await ideaRef.update({ status: "USED" });
      logger.info("Idea marked as used", { ideaId });
      cache.delByTag("ideas");
    } catch (error) {
      logger.error("Failed to mark idea as used:", error);
      throw error;
    }
  }

  /**
   * Reset an idea to unused state
   */
  static async resetIdea(ideaId: string): Promise<void> {
    try {
      const ideaRef = db.collection(this.COLLECTION).doc(ideaId);
      const ideaDoc = await ideaRef.get();

      if (!ideaDoc.exists) {
        throw new NotFoundError("Idea");
      }

      await ideaRef.update({
        used: false,
        updatedAt: Date.now(),
      });

      // Invalidate cache
      cache.delByTag("ideas");

      logger.info("Idea reset to unused", { ideaId });
    } catch (error) {
      logger.error("Failed to reset idea:", error);
      throw error;
    }
  }

  /**
   * Update an existing idea
   */
  static async updateIdea(
    ideaId: string,
    updates: UpdateIdeaRequest
  ): Promise<BlogIdea> {
    try {
      const ideaRef = db.collection(this.COLLECTION).doc(ideaId);
      const ideaDoc = await ideaRef.get();

      if (!ideaDoc.exists) {
        throw new NotFoundError("Idea");
      }

      const updateData: any = {
        ...updates,
        updatedAt: Date.now(),
      };

      // Clean up string fields
      if (updates.topic) updateData.topic = updates.topic.trim();
      if (updates.persona) updateData.persona = updates.persona.trim();
      if (updates.goal) updateData.goal = updates.goal.trim();
      if (updates.targetAudience)
        updateData.targetAudience = updates.targetAudience.trim();
      if (updates.notes) updateData.notes = updates.notes.trim();
      if (updates.tags)
        updateData.tags = updates.tags.map((tag) => tag.trim().toLowerCase());

      await ideaRef.update(updateData);

      // Get updated idea
      const updatedDoc = await ideaRef.get();
      const updatedIdea = {
        ...updatedDoc.data(),
        id: updatedDoc.id,
      } as BlogIdea;

      // Invalidate cache
      cache.delByTag("ideas");

      logger.info("Idea updated", { ideaId, updates: Object.keys(updateData) });
      return updatedIdea;
    } catch (error) {
      logger.error("Failed to update idea:", error);
      throw error;
    }
  }

  /**
   * Delete an idea
   */
  static async deleteIdea(ideaId: string): Promise<void> {
    try {
      const ideaRef = db.collection(this.COLLECTION).doc(ideaId);
      const ideaDoc = await ideaRef.get();

      if (!ideaDoc.exists) {
        throw new NotFoundError("Idea");
      }

      const ideaData = ideaDoc.data() as BlogIdea;
      if (ideaData.status === "USED") {
        throw new ValidationError("Cannot delete an idea that has been used");
      }

      await ideaRef.delete();

      // Invalidate cache
      cache.delByTag("ideas");

      logger.info("Idea deleted", { ideaId, topic: ideaData.topic });
    } catch (error) {
      logger.error("Failed to delete idea:", error);
      throw error;
    }
  }

  /**
   * Get idea statistics
   */
  static async getIdeaStats(): Promise<IdeaStats> {
    try {
      const cacheKey = "ideas:stats";
      const cached = cache.get<IdeaStats>(cacheKey);
      if (cached) return cached;

      const allIdeas = await this.getAllIdeas();

      const stats: IdeaStats = {
        total: allIdeas.length,
        processing: allIdeas.filter((idea) => idea.status === "PROCESSING").length,
        unused: allIdeas.filter((idea) => idea.status === "UNUSED").length,
        byPriority: {
          high: allIdeas.filter((idea) => idea.priority === "high").length,
          medium: allIdeas.filter((idea) => idea.priority === "medium").length,
          low: allIdeas.filter((idea) => idea.priority === "low").length,
        },
        byDifficulty: {
          beginner: allIdeas.filter((idea) => idea.difficulty === "beginner")
            .length,
          intermediate: allIdeas.filter(
            (idea) => idea.difficulty === "intermediate"
          ).length,
          advanced: allIdeas.filter((idea) => idea.difficulty === "advanced")
            .length,
        },
      };

      cache.set(cacheKey, stats, { ttl: this.CACHE_TTL, tags: ["ideas"] });
      return stats;
    } catch (error) {
      logger.error("Failed to get idea stats:", error);
      throw error;
    }
  }

  /**
   * Get a single idea by ID
   */
  static async getIdeaById(ideaId: string): Promise<BlogIdea> {
    try {
      const cacheKey = `idea:${ideaId}`;
      const cached = cache.get<BlogIdea>(cacheKey);
      if (cached) return cached;

      const ideaDoc = await db.collection(this.COLLECTION).doc(ideaId).get();

      if (!ideaDoc.exists) {
        throw new NotFoundError("Idea");
      }

      const idea = { ...ideaDoc.data(), id: ideaDoc.id } as BlogIdea;
      cache.set(cacheKey, idea, { ttl: this.CACHE_TTL, tags: ["ideas"] });

      return idea;
    } catch (error) {
      logger.error("Failed to get idea by ID:", error);
      throw error;
    }
  }

  static async updateIdeaStatus(ideaId: string, status: IdeaStatus): Promise<void> {
    try {
      const ideaRef = db.collection(this.COLLECTION).doc(ideaId);
      await ideaRef.update({ status });
    } catch (error) {
      logger.error("Failed to update idea status:", error);
      throw error;
    }
  }
}
