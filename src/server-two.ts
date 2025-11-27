import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SlackDataSource } from "./datasources/SlackDataSource.js";
import { GoogleDocsDataSource } from "./datasources/GoogleDocsDataSource.js";
import { DatabaseDataSource } from "./datasources/DatabaseDataSource.js";
import { WebSearchDataSource } from "./datasources/WebSearchDataSource.js";
import { QueryOrchestrator } from "./services/QueryOrchestrator.js";
import { IDataSource } from "./datasources/interfaces/IDataSource.js";
import { createDataSource, DataSourceType } from "./config/database.config.js";
import { UserService } from "./services/UserService.js";

// Initialize search data sources (for multi-source queries)
const searchDataSources: IDataSource[] = [];

// Add SLACK if token is provided
if (process.env.SLACK_TOKEN) {
  searchDataSources.push(new SlackDataSource(process.env.SLACK_TOKEN));
}

// Add GOOGLE DOCS if credentials are provided
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    searchDataSources.push(new GoogleDocsDataSource(credentials));
  } catch (error) {
    console.warn('Failed to parse Google credentials:', error);
  }
}

// Add DATABASE if config is provided
if (process.env.DB_HOST) {
  searchDataSources.push(new DatabaseDataSource({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_users',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  }));
}

// Add WEB Search if API key is provided
if (process.env.GOOGLE_API_KEY) {
  searchDataSources.push(new WebSearchDataSource(process.env.GOOGLE_API_KEY));
}

// Initialize query orchestrator
const orchestrator = new QueryOrchestrator(searchDataSources);

// Initialize user management data source
const dataSourceType = (process.env.DATA_SOURCE || 'json') as DataSourceType;
const userDataSource = createDataSource(dataSourceType);
const userService = new UserService(userDataSource);

const server = new McpServer({
  name: "multi-source-search-server",
  version: "2.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// ============================================================================
// MULTI-SOURCE SEARCH TOOLS
// ============================================================================

server.tool(
  "search-all-sources",
  "Search across all connected data sources (Slack, Google Docs, Database, Web)",
  {
    query: z.string().describe("The search query"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 10)"),
  },
  async ({ query, maxResults = 10 }) => {
    let progressMessage = "🔍 Searching across multiple sources...\n\n";
    const progressUpdates: string[] = [];

    try {
      const results = await orchestrator.search(query, (progress) => {
        const emoji = progress.status === 'completed' ? '✅' : progress.status === 'error' ? '❌' : '⏳';
        const status = `${emoji} ${progress.source}: ${progress.status}${
          progress.resultCount !== undefined ? ` (${progress.resultCount} results)` : ''
        }`;
        progressUpdates.push(status);
      });

      const formattedResults = orchestrator.formatResults(results, maxResults);

      return {
        content: [
          {
            type: "text",
            text: progressMessage + progressUpdates.join('\n') + '\n\n' + formattedResults,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "search-source",
  "Search a specific data source",
  {
    source: z.enum(['slack', 'google-docs', 'database', 'web']).describe("The data source to search"),
    query: z.string().describe("The search query"),
  },
  async ({ source, query }) => {
    const dataSource = searchDataSources.find(ds => 
      ds.name.toLowerCase().replace(' ', '-') === source
    );

    if (!dataSource) {
      return {
        content: [{ 
          type: "text", 
          text: `Source '${source}' not found or not configured. Available sources: ${
            searchDataSources.map(ds => ds.name).join(', ')
          }` 
        }],
      };
    }

    try {
      const results = await dataSource.search(query);
      const formatted = orchestrator.formatResults(results);

      return {
        content: [{ type: "text", text: formatted }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ============================================================================
// USER MANAGEMENT TOOLS
// ============================================================================

server.tool(
  "create-user",
  "Create a new user in the database",
  {
    name: z.string(),
    email: z.string().email(),
    address: z.string(),
    phone: z.string(),
  },
  async (params) => {
    try {
      const id = await userService.createUser(params);
      return {
        content: [
          { 
            type: "text", 
            text: `User created successfully with ID: ${id}` 
          }
        ],
      };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Failed to create user: ${error instanceof Error ? error.message : String(error)}` 
          }
        ],
      };
    }
  }
);

server.tool(
  "update-user",
  "Update an existing user's information",
  {
    id: z.string().describe("User ID"),
    name: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
  },
  async (params) => {
    try {
      const { id, ...updateData } = params;
      const success = await userService.updateUser(id, updateData);

      if (!success) {
        return {
          content: [{ type: "text", text: "User not found or no changes made" }],
        };
      }

      return {
        content: [{ type: "text", text: `User ${id} updated successfully` }],
      };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Failed to update user: ${error instanceof Error ? error.message : String(error)}` 
          }
        ],
      };
    }
  }
);

server.tool(
  "delete-user",
  "Delete a user from the database",
  {
    id: z.string().describe("User ID"),
  },
  async (params) => {
    try {
      const success = await userService.deleteUser(params.id);

      if (!success) {
        return {
          content: [{ type: "text", text: "User not found" }],
        };
      }

      return {
        content: [{ type: "text", text: `User ${params.id} deleted successfully` }],
      };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Failed to delete user: ${error instanceof Error ? error.message : String(error)}` 
          }
        ],
      };
    }
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

server.resource(
  "data-sources",
  "sources://all",
  {
    description: "Get list of all connected data sources",
    title: "Data Sources",
    mimeType: "application/json",
  },
  async (uri) => {
    const sources = searchDataSources.map(ds => ({
      name: ds.name,
      connected: true,
    }));

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({ 
            count: sources.length,
            sources,
            userDataSource: dataSourceType 
          }, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  }
);

server.resource(
  "users",
  "users://all",
  {
    description: `Get all users from ${dataSourceType} data source`,
    title: "Users",
    mimeType: "application/json",
  },
  async (uri) => {
    try {
      const users = await userService.getAllUsers();
      
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(users, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ 
              error: "Failed to fetch users",
              message: error instanceof Error ? error.message : String(error)
            }),
            mimeType: "application/json",
          },
        ],
      };
    }
  }
);

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // Connect user data source
    await userDataSource.connect();
    console.log(`Connected to ${dataSourceType} data source for user management`);

    // Connect all search data sources in parallel
    if (searchDataSources.length > 0) {
      console.log('Connecting to search data sources...');
      await Promise.all(searchDataSources.map(ds => ds.connect()));
      console.log(`Connected to ${searchDataSources.length} search data sources: ${
        searchDataSources.map(ds => ds.name).join(', ')
      }`);
    } else {
      console.log('No search data sources configured. Set environment variables to enable search features.');
    }

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Server started successfully");

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await userDataSource.disconnect();
      await Promise.all(searchDataSources.map(ds => ds.disconnect()));
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
