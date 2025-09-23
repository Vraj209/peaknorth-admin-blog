# PeakNorth Blog Automation API Documentation

## Overview

The PeakNorth Blog Automation API is a comprehensive REST API designed to support automated blog content creation and management workflows. It provides endpoints for managing blog ideas, posts, publishing workflows, and integrates seamlessly with N8N automation workflows.

**Base URL**: `http://localhost:3001/api/v1`  
**Version**: v1  
**Environment**: Development

## Authentication

### API Key Authentication

- **Header**: `x-api-key`
- **N8N Workflows**: Required for N8N-specific endpoints
- **Admin Operations**: Optional for enhanced access

### Access Levels

- **Public**: No authentication required
- **Public (with optional API key)**: Enhanced access with API key
- **N8N only**: Requires valid N8N API key
- **Admin only**: Requires admin-level API key

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": "response data",
  "message": "success message (optional)",
  "timestamp": 1234567890123
}
```

### Error Response

```json
{
  "success": false,
  "error": "error message",
  "timestamp": 1234567890123,
  "data": {
    "code": "ERROR_CODE",
    "stack": "error stack (development only)"
  }
}
```

## Ideas Management API

### POST /ideas

Create a new blog idea

**Access**: Public (with optional API key)

**Request Body**:

```json
{
  "topic": "string (5-200 chars, required)",
  "persona": "string (3-100 chars, required)",
  "goal": "string (10-500 chars, required)",
  "targetAudience": "string (optional, max 200 chars)",
  "priority": "low|medium|high (default: medium)",
  "difficulty": "beginner|intermediate|advanced (optional)",
  "tags": ["array", "of", "strings"] (max 10, optional),
  "notes": "string (optional, max 1000 chars)"
}
```

### GET /ideas

Get all blog ideas with filtering and pagination

**Access**: Public (with optional API key)

**Query Parameters**:

- `page`: number (default: 1)
- `limit`: number (1-100, default: 20)
- `sortBy`: createdAt|updatedAt|priority|topic (default: createdAt)
- `sortOrder`: asc|desc (default: desc)
- `used`: boolean (optional)
- `priority`: low|medium|high (optional)
- `category`: string (optional)
- `search`: string (optional)

### GET /ideas/pick

Pick the next best idea for content creation (N8N workflow)

**Access**: N8N only (requires API key)

Returns the highest priority unused idea for automated content creation.

### GET /ideas/unused

Get all unused ideas

**Access**: Public (with optional API key)

### GET /ideas/stats

Get idea statistics

**Access**: Public (with optional API key)

**Response**:

```json
{
  "total": 50,
  "used": 15,
  "unused": 35,
  "byPriority": {
    "low": 10,
    "medium": 25,
    "high": 15
  },
  "byDifficulty": {
    "beginner": 20,
    "intermediate": 20,
    "advanced": 10
  }
}
```

### GET /ideas/:id

Get a single idea by ID

**Access**: Public (with optional API key)

### PUT /ideas/:id

Update an existing idea

**Access**: Public (with optional API key)

**Request Body**: Same as POST /ideas but all fields optional

### POST /ideas/:id/use

Mark an idea as used

**Access**: N8N only (requires API key)

### POST /ideas/:id/reset

Reset an idea to unused state

**Access**: Public (with optional API key)

### DELETE /ideas/:id

Delete an idea

**Access**: Public (with optional API key)

## Posts Management API

### POST /posts

Create a new blog post

**Access**: N8N only (requires API key)

**Request Body**:

```json
{
  "status": "BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED (default: BRIEF)",
  "brief": {
    "topic": "string",
    "persona": "string",
    "goal": "string",
    "targetAudience": "string (optional)",
    "keyPoints": ["array", "of", "strings"] (optional)
  },
  "scheduledAt": 1234567890123 (epoch timestamp, optional),
  "tags": ["array", "of", "strings"] (max 10, optional),
  "category": "string (max 50 chars, optional)",
  "featuredImage": "BlogImage object (optional)",
  "images": ["array", "of", "BlogImage", "objects"] (max 20, optional)
}
```

### GET /posts

Get all blog posts with filtering and pagination

**Access**: Public (with optional API key)

**Query Parameters**:

- `page`: number (default: 1)
- `limit`: number (1-100, default: 20)
- `sortBy`: createdAt|updatedAt|scheduledAt|publishedAt (default: createdAt)
- `sortOrder`: asc|desc (default: desc)
- `status`: BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED
- `category`: string (optional)
- `authorId`: string (optional)
- `search`: string (optional)
- `dateFrom`: ISO date string (optional)
- `dateTo`: ISO date string (optional)

### GET /posts/stats

Get post statistics by status

**Access**: Public (with optional API key)

**Response**:

```json
{
  "total": 100,
  "published": 45,
  "scheduled": 5,
  "needsReview": 10,
  "drafts": 25,
  "approved": 15,
  "byStatus": {
    "BRIEF": 5,
    "OUTLINE": 8,
    "DRAFT": 25,
    "NEEDS_REVIEW": 10,
    "APPROVED": 15,
    "SCHEDULED": 5,
    "PUBLISHED": 45
  }
}
```

### GET /posts/recent

Get recent posts

**Access**: Public (with optional API key)

**Query Parameters**:

- `limit`: number (default: 10)

### GET /posts/:id

Get a single post by ID

**Access**: Public (with optional API key)

### PUT /posts/:id

Update an existing post

**Access**: N8N and Admin

**Request Body**:

```json
{
  "status": "enum (optional)",
  "brief": "PostBrief object (optional)",
  "outline": "PostOutline object (optional)",
  "draft_mdx": "string (500-50000 chars, optional)",
  "seo": "PostSEO object (optional)",
  "scheduledAt": "number (optional)",
  "tags": ["array", "of", "strings"] (optional),
  "category": "string (optional)",
  "reviewNotes": "string (max 1000 chars, optional)",
  "featuredImage": "BlogImage object (optional)",
  "images": ["array", "of", "BlogImage", "objects"] (optional)
}
```

### POST /posts/:id/status

Update post status with optional data patch

**Access**: N8N and Admin

**Request Body**:

```json
{
  "status": "BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED (required)",
  "patch": {
    "outline": "PostOutline object",
    "draft_mdx": "string",
    "wordCount": "number",
    "estimatedReadTime": "number"
  } (optional),
  "reviewNotes": "string (max 1000 chars, optional)"
}
```

### POST /posts/:id/publish

Publish a post immediately

**Access**: N8N and Admin

**Request Body**:

```json
{
  "htmlContent": "string (optional)",
  "publicUrl": "URL string (optional)",
  "slug": "string (optional)",
  "platforms": [
    {
      "name": "string",
      "enabled": "boolean",
      "config": "object (optional)"
    }
  ] (optional),
  "scheduledAt": "number (optional)"
}
```

### DELETE /posts/:id

Delete a post (only if not published)

**Access**: Admin only

## Publishing Management API

### GET /publish/ready

Get posts ready to publish (for N8N workflow)

**Access**: N8N only (requires API key)

Returns approved posts scheduled for current time or past.

### GET /publish/stats

Get publishing statistics

**Access**: Public (with optional API key)

**Response**:

```json
{
  "postsThisWeek": 3,
  "postsThisMonth": 12,
  "avgPostsPerWeek": 2.5,
  "nextScheduledPost": {
    "id": "post123",
    "title": "Upcoming Post Title",
    "scheduledAt": 1234567890123
  },
  "recentlyPublished": [
    {
      "id": "post456",
      "title": "Recent Post Title",
      "publishedAt": 1234567890123,
      "publicUrl": "https://example.com/blog/recent-post"
    }
  ]
}
```

### GET /publish/schedule

Get upcoming publishing schedule

**Access**: Public (with optional API key)

**Query Parameters**:

- `limit`: number (default: 10)

### POST /publish/batch

Publish multiple posts at once

**Access**: N8N only (requires API key)

**Request Body**:

```json
{
  "postIds": ["post1", "post2", "post3"] (required)
}
```

**Response**:

```json
{
  "published": [
    {
      "postId": "post1",
      "success": true,
      "post": "BlogPost object"
    }
  ],
  "errors": [
    {
      "postId": "post2",
      "success": false,
      "error": "Error message"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

### POST /publish/webhook

Webhook endpoint for external publishing platforms

**Access**: N8N only (requires API key)

**Request Body**:

```json
{
  "postId": "string (required)",
  "status": "PostStatus (optional)",
  "publicUrl": "string (optional)",
  "error": "string (optional)"
}
```

## System Endpoints

### GET /health

Health check endpoint

**Access**: Public

**Response**:

```json
{
  "status": "healthy|unhealthy",
  "timestamp": 1234567890123,
  "version": "1.0.0",
  "uptime": 3600.5,
  "services": {
    "firebase": true,
    "cache": true
  },
  "environment": "development"
}
```

### GET /api

API information and feature flags

**Access**: Public

### GET /api/v1/docs

This documentation endpoint (interactive)

**Access**: Public

## Data Models

### BlogIdea

```json
{
  "id": "string",
  "topic": "string",
  "persona": "string",
  "goal": "string",
  "targetAudience": "string (optional)",
  "priority": "low|medium|high",
  "difficulty": "beginner|intermediate|advanced (optional)",
  "used": "boolean",
  "createdAt": "number (epoch timestamp)",
  "tags": ["array", "of", "strings"] (optional),
  "notes": "string (optional)"
}
```

### BlogPost

```json
{
  "id": "string",
  "status": "BRIEF|OUTLINE|DRAFT|NEEDS_REVIEW|APPROVED|SCHEDULED|PUBLISHED",
  "scheduledAt": "number (epoch timestamp, nullable)",
  "publishedAt": "number (epoch timestamp, nullable)",
  "createdAt": "number (epoch timestamp)",
  "updatedAt": "number (epoch timestamp)",
  "brief": "PostBrief object (nullable)",
  "outline": "PostOutline object (nullable)",
  "draft_mdx": "string (nullable)",
  "seo": "PostSEO object (nullable)",
  "featuredImage": "BlogImage object (optional)",
  "images": ["array", "of", "BlogImage", "objects"] (optional),
  "wordCount": "number (optional)",
  "estimatedReadTime": "number (optional)",
  "tags": ["array", "of", "strings"] (optional),
  "category": "string (optional)",
  "publicUrl": "string (optional)",
  "errorMessage": "string (optional)"
}
```

### PostBrief

```json
{
  "topic": "string",
  "persona": "string",
  "goal": "string",
  "targetAudience": "string (optional)",
  "keyPoints": ["array", "of", "strings"] (optional)
}
```

### PostOutline

```json
{
  "title": "string",
  "introduction": "string",
  "sections": [
    {
      "heading": "string",
      "subPoints": ["array", "of", "strings"]
    }
  ],
  "conclusion": "string",
  "callToAction": "string (optional)"
}
```

### PostSEO

```json
{
  "metaTitle": "string (30-60 chars)",
  "metaDescription": "string (120-160 chars)",
  "focusKeyword": "string",
  "keywords": ["array", "of", "strings"],
  "slug": "string",
  "canonicalUrl": "string (optional)",
  "ogTitle": "string (optional)",
  "ogDescription": "string (optional)",
  "ogImage": "string (optional)",
  "twitterTitle": "string (optional)",
  "twitterDescription": "string (optional)",
  "twitterImage": "string (optional)",
  "schema": "object (optional)"
}
```

### BlogImage

```json
{
  "url": "string",
  "storagePath": "string",
  "filename": "string",
  "size": "number",
  "alt": "string (optional)",
  "caption": "string (optional)",
  "width": "number (optional)",
  "height": "number (optional)"
}
```

## Post Status Workflow

The blog post follows a defined status workflow:

1. **BRIEF** → Initial post creation with basic topic information
2. **OUTLINE** → Structured outline with sections and key points
3. **DRAFT** → Complete MDX content draft
4. **NEEDS_REVIEW** → Draft completed, awaiting human review
5. **APPROVED** → Reviewed and approved for publishing
6. **SCHEDULED** → Scheduled for future publication
7. **PUBLISHED** → Live and published to the blog

## Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Invalid or missing API key
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource conflict (e.g., idea already used)
- `INTERNAL_ERROR`: Server error

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **N8N Exemption**: N8N requests with valid API key bypass rate limiting

## Examples

### Create a Blog Idea

```bash
curl -X POST http://localhost:3001/api/v1/ideas \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Advanced TypeScript Patterns for React Applications",
    "persona": "Senior Frontend Developer",
    "goal": "Teach advanced TypeScript patterns that improve React code quality and maintainability",
    "priority": "high",
    "difficulty": "advanced",
    "tags": ["typescript", "react", "patterns"]
  }'
```

### Pick Next Idea (N8N)

```bash
curl -X GET http://localhost:3001/api/v1/ideas/pick \
  -H "x-api-key: your-n8n-api-key"
```

### Update Post Status (N8N)

```bash
curl -X POST http://localhost:3001/api/v1/posts/post123/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-n8n-api-key" \
  -d '{
    "status": "OUTLINE",
    "patch": {
      "outline": {
        "title": "Advanced TypeScript Patterns for React",
        "introduction": "TypeScript has revolutionized...",
        "sections": [
          {
            "heading": "Generic Components",
            "subPoints": ["Type-safe props", "Conditional rendering", "Polymorphic components"]
          }
        ],
        "conclusion": "These patterns will help...",
        "callToAction": "Try implementing these patterns in your next React project"
      }
    }
  }'
```

## Environment Variables

Required environment variables for the API:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001
API_VERSION=v1
API_PREFIX=/api

# Database
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-here
N8N_API_KEY=your-secure-random-api-key-for-n8n-workflows

# External Services
OPENAI_API_KEY=sk-your-openai-api-key-here
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=noreply@peaknorth.com

# URLs
FRONTEND_URL=http://localhost:5173
ADMIN_DASHBOARD_URL=http://localhost:5173
PUBLIC_BLOG_URL=https://peaknorth.com
```

## Support

For API support and questions, please refer to:

- Interactive documentation: `GET /api/v1/docs`
- Health status: `GET /health`
- API information: `GET /api`

