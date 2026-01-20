// Blog-related types and interfaces

export type PostStatus = 
  | 'BRIEF' 
  | 'OUTLINE' 
  | 'DRAFT' 
  | 'NEEDS_REVIEW'
  | 'APPROVED' 
  | 'SCHEDULED' 
  | 'PUBLISHED'
  | 'REGENRATE';

export type IdeaStatus = 'UNUSED' | 'PROCESSING' |'USED';
export type Priority = 'low' | 'medium' | 'high';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface PostBrief {
  topic: string;
  persona: string;
  goal: string;
  targetAudience?: string[];
  keyPoints?: string[];
}

export interface PostOutline {
  title: string;
  introduction: string;
  sections: {
    heading: string;
    subPoints: string[];
    keywords: string[];
  }[];
  conclusion: string;
  callToAction?: string;
}

export interface PostSEO {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  keywords: string[];
  slug: string;
}

export interface BlogImage {
  url: string;
  storagePath: string;
  filename: string;
  size: number;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface PostDraft {
  mdx: string;
  wordCount: number;
  estimatedReadTime: number;
}

export interface BlogPost {
  id: string;
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Idea
  ideaId: string;
  // Content stages
  brief: PostBrief | null;
  outline: PostOutline | null;
  draft: PostDraft | null;
  seo: PostSEO | null;
  
  // Images
  featuredImage?: BlogImage;
  images?: BlogImage[];
  
  // Metadata
  tags?: string[];
  category?: string;

  // Publishing
  publicUrl?: string;
  htmlContent?: string;
  // Error tracking
  errorMessage?: string;
}

export interface BlogIdea {
  id: string;
  status: IdeaStatus;
  topic: string;
  persona: string;
  goal: string;
  targetAudience?: string;
  priority: Priority;
  difficulty?: Difficulty;
  createdAt: Date;
  tags?: string[];
  notes?: string;
}

export interface CadenceConfig {
  intervalDays: number;
  publishHour: number; // 0-23, local time
  timezone: string; // e.g., "America/Toronto"
  draftLeadHours: number; // create draft X hours before publish slot
  reminderHours?: number; // send reminder X hours before publish if not approved
}

// API request/response types
export interface CreatePostRequest {
  brief?: PostBrief;
  outline?: PostOutline;
  draft?: PostDraft;
  scheduledAt?: Date;
  tags?: string[];
  category?: string;
  ideaId?: string;
  seo?: PostSEO;
  featuredImage?: BlogImage;
  images?: BlogImage[];
  publicUrl?: string;
  errorMessage?: string;
}

export interface UpdatePostRequest {
  status?: PostStatus;
  brief?: PostBrief;
  outline?: PostOutline;
  draft?: PostDraft;
  seo?: PostSEO;
  featuredImage?: BlogImage;
  images?: BlogImage[];
  scheduledAt?: Date;
  tags?: string[];
  category?: string;
  ideaId?: string;
  publicUrl?: string;
  errorMessage?: string;
}

export interface UpdatePostStatusRequest {
  status: PostStatus;
  scheduledAt?: Date;
  errorMessage?: string;
}

export interface CreateIdeaRequest {
  status: IdeaStatus;
  topic: string;
  persona: string;
  goal: string;
  targetAudience?: string;
  priority: Priority;
  difficulty?: Difficulty;
  tags?: string[];
  notes?: string;
}

export interface UpdateIdeaRequest {
  topic?: string;
  persona?: string;
  goal?: string;
  targetAudience?: string;
  priority?: Priority;
  difficulty?: Difficulty;
  tags?: string[];
  notes?: string;
  status?: IdeaStatus;
  isBriefCreated?: boolean;
  isApproved?: boolean;
  isPublished?: boolean;
}

// Statistics and analytics types
export interface PostStats {
  total: number;
  published: number;
  scheduled: number;
  needsReview: number;
  drafts: number;
  approved: number;
  byStatus: Record<PostStatus, number>;
}

export interface IdeaStats {
  total: number;
  processing: number;
  unused: number;
  byPriority: Record<Priority, number>;
  byDifficulty: Record<Difficulty, number>;
}

export interface PublishingStats {
  postsThisWeek: number;
  postsThisMonth: number;
  avgPostsPerWeek: number;
  nextScheduledPost?: {
    id: string;
    title?: string;
    scheduledAt: number;
  };
  recentlyPublished: Array<{
    id: string;
    title?: string;
    publishedAt: number;
    publicUrl?: string;
  }>;
}

// Scheduling types
export interface ScheduleSlots {
  scheduledAt: number; // When to publish (epoch ms)
  createAt: number;    // When to create draft (epoch ms)
}

export interface TimeUntilPublish {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}

// Search and filter types
export interface PostFilters {
  status?: PostStatus | PostStatus[];
  dateFrom?: number;
  dateTo?: number;
  tags?: string[];
  category?: string;
  hasErrors?: boolean;
  search?: string; // Search in title, topic, or content
}

export interface IdeaFilters {
  priority?: Priority | Priority[];
  difficulty?: Difficulty | Difficulty[];
  status?: IdeaStatus | IdeaStatus[];
  tags?: string[];
  search?: string; // Search in topic or goal
}

// Content generation types (for n8n integration)
export interface ContentGenerationRequest {
  brief: PostBrief;
  outline?: PostOutline;
  additionalInstructions?: string;
}

export interface ContentGenerationResponse {
  outline?: PostOutline;
  content?: string;
  seo?: PostSEO;
  estimatedReadTime?: number;
  wordCount?: number;
}

// Webhook types (for n8n workflows)
export interface WebhookPayload {
  event: 'post.created' | 'post.approved' | 'post.published' | 'post.regenerate' | 'idea.created';
  data: BlogPost | BlogIdea;
  timestamp: number;
}
