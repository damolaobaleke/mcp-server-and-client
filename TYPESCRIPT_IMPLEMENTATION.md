# Multi-Source MCP Server - TypeScript Implementation

Complete guide for building a Model Context Protocol (MCP) server that connects to multiple data sources simultaneously.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Data Sources](#data-sources)
6. [Usage Examples](#usage-examples)
7. [API Reference](#api-reference)

## Architecture Overview

This implementation provides a flexible MCP server architecture that can:
- Connect to multiple data sources simultaneously (Slack, Google Docs, PostgreSQL, MongoDB, Web)
- Intelligently route queries to relevant sources
- Perform parallel searches across sources
- Aggregate and rank results
- Support both user management and multi-source search

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (server-two.ts)               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Query Orchestrator                       │ │
│  │  • Analyzes query intent                             │ │
│  │  • Routes to relevant sources                        │ │
│  │  • Executes parallel searches                        │ │
│  │  • Aggregates & ranks results                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Data Source Layer                         │ │
│  │                                                        │ │
│  │  ┌──────┐  ┌────────┐  ┌──────┐  ┌──────┐  ┌──────┐ │ │
│  │  │Slack │  │Google  │  │  DB  │  │ Web  │  │ JSON │ │ │
│  │  │      │  │  Docs  │  │      │  │Search│  │      │ │ │
│  │  └──────┘  └────────┘  └──────┘  └──────┘  └──────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── types/
│   └── User.ts                    # Type definitions
├── datasources/
│   ├── interfaces/
│   │   ├── IDataSource.ts         # Search interface
│   │   └── IUserDataSource.ts     # User management interface
│   ├── SlackDataSource.ts         # Slack integration
│   ├── GoogleDocsDataSource.ts    # Google Docs integration
│   ├── DatabaseDataSource.ts      # PostgreSQL search
│   ├── WebSearchDataSource.ts     # Web search (Google)
│   ├── PostgreSQLDataSource.ts    # PostgreSQL user management
│   ├── MongoDBDataSource.ts       # MongoDB user management
│   └── JSONDataSource.ts          # JSON file user management
├── services/
│   ├── QueryOrchestrator.ts       # Multi-source search orchestration
│   └── UserService.ts             # User management service
├── config/
│   └── database.config.ts         # Data source configuration
├── server.ts                      # Original server
└── server-two.ts                  # Multi-source server
```

## Installation

### 1. Install Dependencies

```bash
npm install
```

### Dependencies Installed:
- `@modelcontextprotocol/sdk` - MCP SDK
- `@slack/web-api` - Slack integration
- `googleapis` - Google APIs (Docs, Drive)
- `pg` - PostgreSQL client
- `mongodb` - MongoDB driver
- `axios` - HTTP client for web search
- `zod` - Schema validation

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Choose data source for user management
DATA_SOURCE=json  # Options: json, postgres, mongodb

# PostgreSQL (optional)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mcp_users
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# MongoDB (optional)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=mcp_users

# Slack (optional)
SLACK_TOKEN=xoxb-your-bot-token

# Google APIs (optional)
GOOGLE_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
GOOGLE_CREDENTIALS={"type":"service_account",...}

# Database for search (optional)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_users
DB_USER=postgres
DB_PASSWORD=password
```

## Configuration

### Data Source Selection

The server supports three modes for user management:

1. **JSON File** (default - no setup required)
2. **PostgreSQL** (requires PostgreSQL server)
3. **MongoDB** (requires MongoDB server)

Set via `DATA_SOURCE` environment variable.

### Search Data Sources

Search features are automatically enabled based on environment variables:
- **Slack**: Requires `SLACK_TOKEN`
- **Google Docs**: Requires `GOOGLE_CREDENTIALS`
- **Database**: Requires `DB_HOST` and related vars
- **Web Search**: Requires `GOOGLE_API_KEY`

## Data Sources

### 1. Slack Integration

**Purpose**: Search conversations and messages across Slack channels.

**Setup**:
1. Create a Slack App at https://api.slack.com/apps
2. Add OAuth scopes: `search:read`, `channels:read`
3. Install app to workspace
4. Copy Bot Token to `SLACK_TOKEN`

**Example Query**:
```
"What did John say about the project?"
```

**Code**:
```typescript
const slack = new SlackDataSource(process.env.SLACK_TOKEN);
await slack.connect();
const results = await slack.search("project deadline");
```

### 2. Google Docs Integration

**Purpose**: Search content within Google Docs.

**Setup**:
1. Create Google Cloud Project
2. Enable Google Drive API and Google Docs API
3. Create Service Account
4. Download credentials JSON
5. Share relevant docs with service account email

**Example Query**:
```
"Find documentation about authentication"
```

**Code**:
```typescript
const docs = new GoogleDocsDataSource(credentials);
await docs.connect();
const results = await docs.search("authentication");
```

### 3. Database Search

**Purpose**: Query structured data in PostgreSQL.

**Setup**:
1. Install PostgreSQL
2. Create database: `createdb mcp_users`
3. Configure connection in `.env`

**Example Query**:
```
"How many users do we have using Datadog?"
```

**Code**:
```typescript
const db = new DatabaseDataSource(config);
await db.connect();
const results = await db.search("datadog");
```

### 4. Web Search

**Purpose**: Search the public web via Google Custom Search.

**Setup**:
1. Create Google Custom Search Engine at https://cse.google.com
2. Get API key from Google Cloud Console
3. Configure `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`

**Example Query**:
```
"Latest updates on MCP protocol"
```

**Code**:
```typescript
const web = new WebSearchDataSource(apiKey);
await web.connect();
const results = await web.search("MCP protocol");
```

## Usage Examples

### Running the Server

```bash
# Run original server
npm run server:dev

# Run multi-source server
npm run server-two:dev

# Run with MCP inspector
npm run server-two:inspect
```

### Multi-Source Search

The `search-all-sources` tool intelligently searches across all configured sources:

**Query**: "How many users do we have using Datadog?"

**Process**:
1. Query Orchestrator analyzes intent
2. Determines relevant sources (Database, Slack, Docs)
3. Executes parallel searches
4. Shows progress: "⏳ Database: searching..."
5. Aggregates results
6. Returns ranked results from all sources

**Response**:
```
Found 11 results across 3 sources:

**Database** (2 results):
- Users using Datadog: 156
- Datadog integration active since: 2023-01-15

**Slack** (5 results):
- Discussion about Datadog pricing in #engineering
- Datadog setup guide shared by @john

**Google Docs** (4 results):
- Datadog Integration Guide
- Monitoring Best Practices
```

### User Management

```typescript
// Create user
await userService.createUser({
  name: "John Doe",
  email: "john@example.com",
  address: "123 Main St",
  phone: "555-0100"
});

// Get all users
const users = await userService.getAllUsers();

// Update user
await userService.updateUser(1, {
  phone: "555-0101"
});

// Delete user
await userService.deleteUser(1);
```

## API Reference

### Tools

#### `search-all-sources`
Search across all configured data sources.

**Parameters**:
- `query` (string, required): Search query
- `maxResults` (number, optional): Max results (default: 10)

**Returns**: Formatted search results with source breakdown

**Example**:
```json
{
  "query": "datadog users",
  "maxResults": 10
}
```

#### `search-source`
Search a specific data source.

**Parameters**:
- `source` (enum, required): `slack`, `google-docs`, `database`, `web`
- `query` (string, required): Search query

**Example**:
```json
{
  "source": "slack",
  "query": "project deadline"
}
```

#### `create-user`
Create a new user.

**Parameters**:
- `name` (string, required)
- `email` (string, required)
- `address` (string, required)
- `phone` (string, required)

#### `update-user`
Update existing user.

**Parameters**:
- `id` (string, required)
- `name` (string, optional)
- `email` (string, optional)
- `address` (string, optional)
- `phone` (string, optional)

#### `delete-user`
Delete a user.

**Parameters**:
- `id` (string, required)

### Resources

#### `sources://all`
List all connected data sources.

**Response**:
```json
{
  "count": 4,
  "sources": [
    {"name": "Slack", "connected": true},
    {"name": "Google Docs", "connected": true},
    {"name": "Database", "connected": true},
    {"name": "Web", "connected": true}
  ],
  "userDataSource": "json"
}
```

#### `users://all`
Get all users from the configured data source.

**Response**: Array of user objects

## Key Concepts

### 1. Intelligent Query Routing

The `isRelevantFor()` method in each data source determines if it should be searched:

```typescript
isRelevantFor(query: string): boolean {
  const keywords = ['slack', 'message', 'conversation'];
  return keywords.some(kw => query.toLowerCase().includes(kw));
}
```

### 2. Parallel Execution

Searches run in parallel for speed:

```typescript
const searchPromises = sources.map(source => source.search(query));
const results = await Promise.all(searchPromises);
```

### 3. Progress Tracking

Real-time feedback as searches complete:

```typescript
onProgress({
  source: 'Slack',
  status: 'searching' | 'completed' | 'error',
  resultCount: 5
});
```

### 4. Result Ranking

Results are ranked by relevance score (0-1):

```typescript
interface SearchResult {
  source: string;
  title: string;
  content: string;
  relevanceScore: number;  // Higher = more relevant
  url?: string;
  metadata?: Record<string, any>;
}
```

## Extending the System

### Adding a New Data Source

1. **Create Data Source Class**:

```typescript
// src/datasources/NotionDataSource.ts
import { IDataSource, SearchResult } from './interfaces/IDataSource.js';

export class NotionDataSource implements IDataSource {
  name = 'Notion';
  
  async connect(): Promise<void> {
    // Setup Notion client
  }
  
  async disconnect(): Promise<void> {
    // Cleanup
  }
  
  isRelevantFor(query: string): boolean {
    return query.toLowerCase().includes('notion');
  }
  
  async search(query: string): Promise<SearchResult[]> {
    // Implement search logic
    return [];
  }
}
```

2. **Add to Server**:

```typescript
// src/server-two.ts
if (process.env.NOTION_TOKEN) {
  searchDataSources.push(new NotionDataSource(process.env.NOTION_TOKEN));
}
```

3. **Update Environment Variables**:

```env
NOTION_TOKEN=secret_xxx
```

## Troubleshooting

### Issue: "Cannot find module"
**Solution**: Run `npm install` to install dependencies

### Issue: TypeScript errors
**Solution**: Run `npm run server:build` to compile TypeScript

### Issue: No search results
**Solution**: Check that environment variables are set correctly and data sources are connected

### Issue: Slack authentication failed
**Solution**: Verify `SLACK_TOKEN` has correct scopes: `search:read`, `channels:read`

### Issue: Google Docs access denied
**Solution**: Share documents with the service account email from credentials

## Best Practices

1. **Environment Variables**: Never commit `.env` file with real credentials
2. **Error Handling**: All data source methods include try-catch blocks
3. **Connection Management**: Always disconnect data sources on shutdown
4. **Rate Limiting**: Be aware of API rate limits (especially Slack, Google)
5. **Security**: Use service accounts with minimal required permissions
6. **Testing**: Test each data source independently before integration

## Performance Considerations

- **Parallel Searches**: Searches run concurrently for faster results
- **Connection Pooling**: PostgreSQL uses connection pooling
- **Caching**: Consider adding caching layer for frequently accessed data
- **Timeouts**: Add timeouts for external API calls
- **Pagination**: Implement pagination for large result sets

## License

MIT

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Slack API](https://api.slack.com)
- [Google APIs](https://developers.google.com/docs/api)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [MongoDB](https://docs.mongodb.com/)
