# PeakNorth Blog Automation - Backend

A robust, scalable Node.js backend API for the PeakNorth Blog Automation System, built with modern TypeScript, Express, and Firebase.

## Features

- **Modular Architecture**: Clean separation of concerns with services, routes, and middleware
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Firebase Integration**: Seamless integration with Firestore and Firebase Storage
- **N8N Workflow Support**: Dedicated endpoints for automation workflows
- **Comprehensive Validation**: Zod-based request validation and sanitization
- **Smart Caching**: In-memory caching for improved performance
- **Security First**: Rate limiting, CORS, helmet, and API key authentication
- **Structured Logging**: Winston-based logging with multiple transports
- **Error Handling**: Centralized error handling with detailed error responses
- **Health Monitoring**: Built-in health checks and system monitoring

## System Architecture

```   
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   N8N Workflows │    │   Backend API    │    │   Firebase      │
│                 │◄──►│                  │◄──►│   Firestore     │
│ • Cadence Plan  │    │ • Express Server │    │   Storage       │
│ • Publisher     │    │ • Services       │    │                 │
└─────────────────┘    │ • Routes         │    └─────────────────┘
                       │ • Middleware     │
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │   Admin Frontend │
                       │   React App      │
                       └──────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3+
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Validation**: Zod
- **Logging**: Winston
- **Authentication**: API Key based
- **Caching**: In-memory cache
- **Security**: Helmet, CORS, Rate Limiting

## Installation

### Prerequisites

- Node.js 18 or higher
- Firebase project with Firestore enabled
- OpenAI API key (for n8n workflows)

### Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd peaknorth-admin-backend
npm install
```

2. **Environment Configuration**:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Firebase Setup**:
   - Create a Firebase project
   - Enable Firestore Database
   - Generate service account key (for production)
   - Update environment variables

4. **Build the project**:
```bash
npm run build
```

5. **Start the server**:
```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

### Environment Variables

```env
NODE_ENV=
PORT=
API_VERSION=
API_PREFIX=

FIREBASE_PROJECT_ID=
FIREBASE_DATABASE_URL=
FIREBASE_STORAGE_BUCKET=
FIREBASE_SERVICE_ACCOUNT_KEY=

JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=

RATE_LIMIT_WINDOW_MS=
RATE_LIMIT_MAX_REQUESTS=

OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_MAX_TOKENS=

N8N_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

FRONTEND_URL=
ADMIN_DASHBOARD_URL=
PUBLIC_BLOG_URL=

LOG_LEVEL=
LOG_FORMAT=
LOG_FILE_PATH=

ENABLE_CACHING=
ENABLE_RATE_LIMITING=
ENABLE_REQUEST_LOGGING=
ENABLE_CORS=

SENTRY_DSN=
GOOGLE_ANALYTICS_ID=

DEBUG=
MOCK_EXTERNAL_SERVICES=
```

### Firebase Setup

1. **Service Account Key** (Production):
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Set the entire JSON as `FIREBASE_SERVICE_ACCOUNT_KEY`

2. **Default Credentials** (Development):
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login: `firebase login`
   - Set application default credentials: `gcloud auth application-default login`

## API Endpoints

### Health & Info

- `GET /health` - Health check
- `GET /api` - API information
- `GET /api/v1/docs` - API documentation

### Blog Ideas

- `POST /api/v1/ideas` - Create new idea
- `GET /api/v1/ideas` - Get all ideas (with filters)
- `GET /api/v1/ideas/pick` - Pick next idea (n8n only)
- `GET /api/v1/ideas/unused` - Get unused ideas
- `GET /api/v1/ideas/stats` - Get idea statistics
- `GET /api/v1/ideas/:id` - Get idea by ID
- `PUT /api/v1/ideas/:id` - Update idea
- `POST /api/v1/ideas/:id/use` - Mark as used (n8n only)
- `POST /api/v1/ideas/:id/reset` - Reset to unused
- `DELETE /api/v1/ideas/:id` - Delete idea

### Blog Posts

- `POST /api/v1/posts` - Create new post (n8n only)
- `GET /api/v1/posts` - Get all posts (with filters)
- `GET /api/v1/posts/stats` - Get post statistics
- `GET /api/v1/posts/recent` - Get recent posts
- `GET /api/v1/posts/:id` - Get post by ID
- `PUT /api/v1/posts/:id` - Update post
- `POST /api/v1/posts/:id/status` - Update post status
- `POST /api/v1/posts/:id/publish` - Publish post
- `DELETE /api/v1/posts/:id` - Delete post

### Publishing

- `GET /api/v1/publish/ready` - Get ready posts (n8n only)
- `GET /api/v1/publish/stats` - Publishing statistics
- `GET /api/v1/publish/schedule` - Upcoming schedule
- `POST /api/v1/publish/batch` - Batch publish (n8n only)
- `POST /api/v1/publish/webhook` - Publishing webhook (n8n only)

## Authentication

### API Key Authentication

For n8n workflows and admin operations:

```http
GET /api/v1/ideas/pick
x-api-key: your-secure-api-key
```

### Public Endpoints

Some endpoints are publicly accessible for the admin dashboard:
- `GET /api/v1/ideas` (with optional API key)
- `GET /api/v1/posts` (with optional API key)
- Health and info endpoints

## Data Models

### Blog Idea

```typescript
interface BlogIdea {
  id: string;
  topic: string;
  persona: string;
  goal: string;
  targetAudience?: string;
  priority: 'low' | 'medium' | 'high';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  used: boolean;
  createdAt: number;
  tags?: string[];
  notes?: string;
}
```

### Blog Post

```typescript
interface BlogPost {
  id: string;
  status: 'BRIEF' | 'OUTLINE' | 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED';
  scheduledAt: number | null;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  
  // Content stages
  brief: PostBrief | null;
  outline: PostOutline | null;
  draft_mdx: string | null;
  seo: PostSEO | null;
  
  // Images
  featuredImage?: BlogImage;
  images?: BlogImage[];
  
  // Metadata
  wordCount?: number;
  estimatedReadTime?: number;
  tags?: string[];
  category?: string;
  publicUrl?: string;
  errorMessage?: string;
}
```

## N8N Workflow Integration

### Workflow A: Cadence Planner

**Endpoint**: `GET /api/v1/ideas/pick`
- Picks the next highest priority unused idea
- Returns idea data for content generation

**Endpoint**: `POST /api/v1/posts`
- Creates new post with BRIEF status
- Accepts idea data and initial content

**Endpoint**: `PUT /api/v1/posts/:id`
- Updates post with generated outline and draft
- Changes status to NEEDS_REVIEW

### Workflow B: Publisher Runner

**Endpoint**: `GET /api/v1/publish/ready`
- Returns approved posts ready to publish
- Filters by scheduledAt <= now

**Endpoint**: `POST /api/v1/posts/:id/publish`
- Publishes post immediately
- Updates status to PUBLISHED

## Development

### Scripts

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Production start
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm test
npm run test:watch
```

### Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # Firebase setup
│   └── environment.ts # Environment validation
├── middleware/      # Express middleware
│   ├── auth.ts      # Authentication
│   └── errorHandler.ts # Error handling
├── routes/          # API routes
│   ├── ideas.ts     # Ideas endpoints
│   ├── posts.ts     # Posts endpoints
│   └── publish.ts   # Publishing endpoints
├── services/        # Business logic
│   ├── BlogIdeaService.ts
│   └── BlogPostService.ts
├── types/           # TypeScript definitions
│   ├── blog.ts      # Blog-related types
│   └── common.ts    # Common interfaces
├── utils/           # Utility functions
│   ├── cache.ts     # In-memory cache
│   ├── logger.ts    # Winston logger
│   └── scheduling.ts # Date/time utilities
├── validators/      # Zod schemas
│   └── blogValidators.ts
└── server.ts        # Main application
```

## Error Handling

The API uses structured error responses:

```json
{
  "success": false,
  "error": "Validation failed",
  "timestamp": 1640995200000,
  "data": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "topic",
        "message": "Topic must be at least 5 characters long"
      }
    ]
  }
}
```

### Error Types

- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Invalid or missing API key
- `FORBIDDEN` - Access denied
- `CONFLICT` - Resource conflict
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Monitoring

### Health Checks

The `/health` endpoint provides system status:

```json
{
  "status": "healthy",
  "timestamp": 1640995200000,
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "firebase": "up",
    "cache": "up"
  },
  "environment": "production"
}
```

### Logging

Structured logging with multiple levels:
- `error` - Error conditions
- `warn` - Warning conditions  
- `info` - Informational messages
- `debug` - Debug information

Log categories:
- `request` - HTTP requests
- `security` - Security events
- `database` - Database operations
- `external` - External service calls
- `performance` - Performance metrics

## Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### Platform-Specific

- **Railway**: Connect GitHub repo, set environment variables
- **Vercel**: Use serverless functions setup
- **DigitalOcean App Platform**: Use app.yaml configuration
- **Google Cloud Run**: Deploy with Cloud Build

### Environment Setup

1. Set all required environment variables
2. Ensure Firebase service account key is properly configured
3. Test health endpoint after deployment
4. Configure n8n workflows with new API URL

## Troubleshooting

### Common Issues

**Firebase Connection Failed**:
- Verify `FIREBASE_PROJECT_ID` is correct
- Check service account key format
- Ensure Firestore is enabled

**N8N Workflow Failures**:
- Verify `N8N_API_KEY` matches between server and n8n
- Check server URL in n8n environment variables
- Review n8n execution logs

**Rate Limiting Issues**:
- N8N requests bypass rate limiting
- Adjust `RATE_LIMIT_MAX_REQUESTS` if needed
- Check API key configuration

### Debug Mode

Enable debug logging:
```bash
DEBUG=peaknorth:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and ESLint rules
4. Add tests for new functionality
5. Submit a pull request

---

**Built with true heart**
