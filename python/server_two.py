"""Multi-source MCP Server - Python Implementation."""

import os
import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Resource, Tool, TextContent

from datasources.slack_datasource import SlackDataSource
from datasources.json_datasource import JSONDataSource
from services.query_orchestrator import QueryOrchestrator, SearchProgress
from types import CreateUserDTO


# Initialize search data sources
search_data_sources = []

# Add Slack if token is provided
if os.getenv('SLACK_TOKEN'):
    search_data_sources.append(SlackDataSource(os.getenv('SLACK_TOKEN')))

# Add more data sources as needed
# if os.getenv('GOOGLE_CREDENTIALS'):
#     search_data_sources.append(GoogleDocsDataSource(...))

# Initialize query orchestrator
orchestrator = QueryOrchestrator(search_data_sources)

# Initialize user management data source
data_source_type = os.getenv('DATA_SOURCE', 'json')
user_data_source = JSONDataSource('./data/users.json')

# Create MCP server
app = Server("multi-source-search-server")


@app.list_resources()
async def list_resources() -> list[Resource]:
    """List available resources."""
    return [
        Resource(
            uri="sources://all",
            name="Data Sources",
            mimeType="application/json",
            description="Get list of all connected data sources"
        ),
        Resource(
            uri="users://all",
            name="Users",
            mimeType="application/json",
            description=f"Get all users from {data_source_type} data source"
        )
    ]


@app.read_resource()
async def read_resource(uri: str) -> str:
    """Read a resource."""
    if uri == "sources://all":
        sources = [{"name": ds.name, "connected": True} for ds in search_data_sources]
        import json
        return json.dumps({
            "count": len(sources),
            "sources": sources,
            "userDataSource": data_source_type
        }, indent=2)
    
    elif uri == "users://all":
        try:
            users = await user_data_source.get_all_users()
            import json
            users_data = [
                {
                    'id': u.id,
                    'name': u.name,
                    'email': u.email,
                    'address': u.address,
                    'phone': u.phone
                }
                for u in users
            ]
            return json.dumps(users_data, indent=2)
        except Exception as e:
            import json
            return json.dumps({"error": "Failed to fetch users", "message": str(e)})
    
    raise ValueError(f"Unknown resource: {uri}")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="search-all-sources",
            description="Search across all connected data sources",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "maxResults": {
                        "type": "number",
                        "description": "Maximum number of results to return (default: 10)"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="search-source",
            description="Search a specific data source",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "enum": ["slack", "google-docs", "database", "web"],
                        "description": "The data source to search"
                    },
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    }
                },
                "required": ["source", "query"]
            }
        ),
        Tool(
            name="create-user",
            description="Create a new user in the database",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "address": {"type": "string"},
                    "phone": {"type": "string"}
                },
                "required": ["name", "email", "address", "phone"]
            }
        ),
        Tool(
            name="update-user",
            description="Update an existing user's information",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "User ID"},
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "address": {"type": "string"},
                    "phone": {"type": "string"}
                },
                "required": ["id"]
            }
        ),
        Tool(
            name="delete-user",
            description="Delete a user from the database",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "User ID"}
                },
                "required": ["id"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute a tool."""
    
    if name == "search-all-sources":
        query = arguments["query"]
        max_results = arguments.get("maxResults", 10)
        
        progress_message = "🔍 Searching across multiple sources...\n\n"
        progress_updates = []
        
        def on_progress(progress: SearchProgress):
            emoji = '✅' if progress.status == 'completed' else '❌' if progress.status == 'error' else '⏳'
            status = f"{emoji} {progress.source}: {progress.status}"
            if progress.result_count is not None:
                status += f" ({progress.result_count} results)"
            progress_updates.append(status)
        
        try:
            results = await orchestrator.search(query, on_progress)
            formatted_results = orchestrator.format_results(results, max_results)
            
            response = progress_message + '\n'.join(progress_updates) + '\n\n' + formatted_results
            return [TextContent(type="text", text=response)]
        except Exception as e:
            return [TextContent(type="text", text=f"Search failed: {str(e)}")]
    
    elif name == "search-source":
        source_name = arguments["source"]
        query = arguments["query"]
        
        # Find the data source
        data_source = None
        for ds in search_data_sources:
            if ds.name.lower().replace(' ', '-') == source_name:
                data_source = ds
                break
        
        if not data_source:
            available = ', '.join(ds.name for ds in search_data_sources)
            return [TextContent(
                type="text",
                text=f"Source '{source_name}' not found or not configured. Available sources: {available}"
            )]
        
        try:
            results = await data_source.search(query)
            formatted = orchestrator.format_results(results)
            return [TextContent(type="text", text=formatted)]
        except Exception as e:
            return [TextContent(type="text", text=f"Search failed: {str(e)}")]
    
    elif name == "create-user":
        try:
            user = CreateUserDTO(
                name=arguments["name"],
                email=arguments["email"],
                address=arguments["address"],
                phone=arguments["phone"]
            )
            user_id = await user_data_source.create_user(user)
            return [TextContent(type="text", text=f"User created successfully with ID: {user_id}")]
        except Exception as e:
            return [TextContent(type="text", text=f"Failed to create user: {str(e)}")]
    
    elif name == "update-user":
        try:
            user_id = arguments["id"]
            update_data = {k: v for k, v in arguments.items() if k != "id"}
            
            success = await user_data_source.update_user(user_id, update_data)
            
            if not success:
                return [TextContent(type="text", text="User not found or no changes made")]
            
            return [TextContent(type="text", text=f"User {user_id} updated successfully")]
        except Exception as e:
            return [TextContent(type="text", text=f"Failed to update user: {str(e)}")]
    
    elif name == "delete-user":
        try:
            user_id = arguments["id"]
            success = await user_data_source.delete_user(user_id)
            
            if not success:
                return [TextContent(type="text", text="User not found")]
            
            return [TextContent(type="text", text=f"User {user_id} deleted successfully")]
        except Exception as e:
            return [TextContent(type="text", text=f"Failed to delete user: {str(e)}")]
    
    raise ValueError(f"Unknown tool: {name}")


async def main():
    """Main entry point."""
    # Connect to data sources
    await user_data_source.connect()
    print(f"Connected to {data_source_type} data source for user management")
    
    if search_data_sources:
        print('Connecting to search data sources...')
        await asyncio.gather(*[ds.connect() for ds in search_data_sources])
        print(f"Connected to {len(search_data_sources)} search data sources: {', '.join(ds.name for ds in search_data_sources)}")
    else:
        print('No search data sources configured. Set environment variables to enable search features.')
    
    # Run the server
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
