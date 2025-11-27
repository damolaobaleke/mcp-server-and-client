### MCP

__Strengths:__

- Good separation of resources (read operations) and tools (write operations)
- Proper use of MCP SDK types and schemas
- Clean async/await patterns
- Resource templates with URI parameters

__Areas for Improvement:__

- Currently tightly coupled to local JSON file
- No abstraction layer for data access
- Hardcoded file paths
- No error handling for database operations

## How to Add Different Data Sources
<!-- Resource args. (name, template, description object, controller )-->

### 1. __Google Docs Integration__

```javascript
import { google } from 'googleapis';

// Create a resource for Google Docs
server.resource(
  "google-doc",
  new ResourceTemplate("gdocs://{docId}", { list: undefined }),
  {
    description: "Fetch content from a Google Doc",
    title: "Google Doc",
    mimeType: "text/plain",
  },
  async (uri, { docId }) => {
    const auth = await getGoogleAuth(); // OAuth2 setup
    const docs = google.docs({ version: 'v1', auth });
    
    const doc = await docs.documents.get({ documentId: docId as string });
    
    return {
      contents: [{
        uri: uri.href,
        text: extractTextFromDoc(doc.data),
        mimeType: "text/plain",
      }]
    };
  }
);
```

### 2. __Slack Integration__

Using the Slack Web API:
```javascript
import { WebClient } from '@slack/web-api';

const slackClient = new WebClient(process.env.SLACK_TOKEN);

server.resource(
  "slack-messages",
  new ResourceTemplate("slack://{channelId}/messages", { list: undefined }),
  {
    description: "Get recent messages from a Slack channel",
    title: "Slack Messages",
    mimeType: "application/json",
  },
  async (uri, { channelId }) => {
    const result = await slackClient.conversations.history({
      channel: channelId as string,
      limit: 100
    });
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(result.messages),
        mimeType: "application/json",
      }]
    };
  }
);
```

### __SQL Database Integration__

Example using PostgreSQL:
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

server.resource(
  "sql-users",
  "db://users/all",
  {
    description: "Get all users from PostgreSQL",
    title: "Database Users",
    mimeType: "application/json",
  },
  async (uri) => {
    const result = await pool.query('SELECT * FROM users');
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(result.rows),
        mimeType: "application/json",
      }]
    };
  }
);
```
4. __NoSQL Database (MongoDB)__
```javascript
import { MongoClient } from 'mongodb';

const mongoClient = new MongoClient(process.env.MONGODB_URI);
await mongoClient.connect();
const db = mongoClient.db('mydb');

server.resource(
  "mongo-users",
  "mongodb://users/all",
  {
    description: "Get all users from MongoDB",
    title: "MongoDB Users",
    mimeType: "application/json",
  },
  async (uri) => {
    const users = await db.collection('users').find({}).toArray();
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(users),
        mimeType: "application/json",
      }]
    };
  }
);

```
5. __Web Scraping/API__
```javascript
import axios from 'axios';

server.resource(
  "web-content",
  new ResourceTemplate("web://{domain}/{path}", { list: undefined }),
  {
    description: "Fetch content from a web URL",
    title: "Web Content",
    mimeType: "text/html",
  },
  async (uri, { domain, path }) => {
    const url = `https://${domain}/${path}`;
    const response = await axios.get(url);
    
    return {
      contents: [{
        uri: uri.href,
        text: response.data,
        mimeType: "text/html",
      }]
    };
  }
);

```

## Architecture Improvements

### 1. __Create Data Source Abstraction Layer__
```bash
// src/datasources/BaseDataSource.ts
interface DataSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  createUser(user: Partial<User>): Promise<string>;
}

// src/datasources/PostgreSQLDataSource.ts
class PostgreSQLDataSource implements DataSource {
  // Implementation
}

// src/datasources/MongoDBDataSource.ts
class MongoDBDataSource implements DataSource {
  // Implementation
}
```
```bash
src/
├── server.ts                    # Main MCP server
├── config/
│   └── database.config.ts       # Database configuration
├── datasources/
│   ├── interfaces/
│   │   └── IUserDataSource.ts   # Interface definition
│   ├── PostgreSQLDataSource.ts  # PostgreSQL implementation
│   ├── MongoDBDataSource.ts     # MongoDB implementation
│   └── JSONDataSource.ts        # existing JSON file implementation
├── services/
│   └── UserService.ts           # Business logic layer
└── types/
    └── User.ts                  # Type definitions
```


### Advanced

a __Multi-Source Query Orchestrator__ that can intelligently search across multiple data sources simultaneously and aggregate results. 

## Key Concepts

1. __All data sources are initialized at startup__ (not switched between)
2. __Query Router__ analyzes the question and determines which sources to query
3. __Parallel Search__ across multiple sources with progress updates
4. __Result Aggregation__ combines and ranks results from different sources
5. __Streaming Responses__ to show "searching..." status


┌─────────────────────────────────────────┐
│         MCP Server (Your Bot)           │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Query Orchestrator              │ │
│  │  - Parse query intent             │ │
│  │  - Route to appropriate sources   │ │
│  │  - Aggregate results              │ │
│  └───────────────────────────────────┘ │
│              ▼                          │
│  ┌───────────────────────────────────┐ │
│  │    Search Manager                 │ │
│  │  - Parallel execution             │ │
│  │  - Progress tracking              │ │
│  │  - Result ranking                 │ │
│  └───────────────────────────────────┘ │
│              ▼                          │
│  ┌─────┬─────┬─────┬─────┬──────────┐ │
│  │Slack│Docs │ Web │ DB  │  More... │ │
│  └─────┴─────┴─────┴─────┴──────────┘ │
└─────────────────────────────────────────┘
