# Multi-Source MCP Server - Python Implementation

Complete guide for building a Model Context Protocol (MCP) server in Python that connects to multiple data sources simultaneously.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Data Sources](#data-sources)
6. [Usage Examples](#usage-examples)
7. [API Reference](#api-reference)

## Architecture Overview

This Python implementation provides the same flexible MCP server architecture as the TypeScript version, with:
- Multiple data source support (Slack, Google Docs, PostgreSQL, MongoDB, Web)
- Intelligent query routing
- Parallel search execution
- Result aggregation and ranking
- User management capabilities

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  MCP Server (server_two.py)                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           QueryOrchestrator                           │ │
│  │  • Analyzes query intent                             │ │
│  │  • Routes to relevant sources                        │ │
│  │  • Executes parallel searches (asyncio)              │ │
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
python/
├── types.py                              # Type definitions (dataclasses)
├── datasources/
│   ├── interfaces.py                     # Abstract base classes
│   ├── slack_datasource.py               # Slack integration
│   ├── google_docs_datasource.py         # Google Docs integration
│   ├── database_datasource.py            # PostgreSQL search
│   ├── web_search_datasource.py          # Web search
│   ├── postgresql_datasource.py          # PostgreSQL user mgmt
│   ├── mongodb_datasource.py             # MongoDB user mgmt
│   └── json_datasource.py                # JSON file user mgmt
├── services/
│   ├── query_orchestrator.py             # Multi-source orchestration
│   └── user_service.py                   # User management service
└── server_two.py                         # Main MCP server
```

## Installation

### 1. Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r python/requirements.txt
```

### Dependencies:
- `mcp` - MCP Python SDK
- `slack-sdk` - Slack integration
- `google-api-python-client` - Google APIs
- `psycopg2-binary` - PostgreSQL client
- `pymongo` - MongoDB driver
- `aiohttp` - Async HTTP client
- `aiofiles` - Async file I/O
- `python-dotenv` - Environment variables

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials (same as TypeScript version).

## Configuration

### Python-Specific Considerations

1. **Async/Await**: Python uses `async`/`await` for asynchronous operations
2. **Type Hints**: Uses Python 3.10+ type hints (`list[User]`, `dict[str, Any]`)
3. **Dataclasses**: Uses `@dataclass` for simple data structures
4. **ABC**: Uses Abstract Base Classes for interfaces

### Environment Variables

Same as TypeScript version - see `.env.example`

## Data Sources

### 1. Slack Integration

**Implementation**: `slack_datasource.py`

```python
from slack_sdk.web.async_client import AsyncWebClient
from datasources.interfaces import IDataSource, SearchResult

class SlackDataSource(IDataSource):
    def __init__(self, token: str):
        self.client = AsyncWebClient(token=token)
    
    async def search(self, query: str) -> list[SearchResult]:
        response = await self.client.search_messages(query=query)
        # Process and return results
```

**Key Features**:
- Uses `slack-sdk` async client
- Automatic connection testing
- Message search with context

### 2. Google Docs Integration

**Implementation**: `google_docs_datasource.py`

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

class GoogleDocsDataSource(IDataSource):
    def __init__(self, credentials_dict: dict):
        self.credentials = service_account.Credentials.from_service_account_info(
            credentials_dict,
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
    
    async def search(self, query: str) -> list[SearchResult]:
        # Search Drive and fetch doc content
```

**Key Features**:
- Service account authentication
- Async file operations
- Content extraction from docs

### 3. JSON File Data Source

**Implementation**: `json_datasource.py`

```python
import aiofiles
from pathlib import Path

class JSONDataSource(IUserDataSource):
    async def _read_users(self) -> list[User]:
        async with aiofiles.open(self.file_path, 'r') as f:
            data = await f.read()
            return [User(**u) for json.loads(data)]
```

**Key Features**:
- Async file I/O with `aiofiles`
- Automatic file creation
- No external dependencies

## Usage Examples

### Running the Server

```bash
# Activate virtual environment
source venv/bin/activate

# Run the server
python python/server_two.py
```

### Using with MCP Inspector

```bash
# Install MCP inspector (if not already installed)
pip install mcp-inspector

# Run with inspector
mcp-inspector python python/server_two.py
```

### Example: Multi-Source Search

```python
# In your MCP client
result = await client.call_tool(
    "search-all-sources",
    {
        "query": "How many users do we have using Datadog?",
        "maxResults": 10
    }
)
```

**Response**:
```
🔍 Searching across multiple sources...

⏳ Slack: searching
⏳ Database: searching
✅ Database: completed (2 results)
✅ Slack: completed (5 results)

Found 7 results across 2 sources:

**Database** (2 results):
- Users using Datadog: 156
- Datadog integration active since: 2023-01-15

**Slack** (5 results):
- Discussion about Datadog pricing in #engineering
- Datadog setup guide shared by @john
```

### Example: User Management

```python
# Create user
await client.call_tool("create-user", {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "address": "456 Oak St",
    "phone": "555-0200"
})

# Update user
await client.call_tool("update-user", {
    "id": "1",
    "phone": "555-0201"
})

# Delete user
await client.call_tool("delete-user", {
    "id": "1"
})
```

## API Reference

### Tools

Same tools as TypeScript version:
- `search-all-sources`
- `search-source`
- `create-user`
- `update-user`
- `delete-user`

See TypeScript documentation for detailed parameters.

### Resources

Same resources as TypeScript version:
- `sources://all`
- `users://all`

## Python-Specific Features

### 1. Type Hints

```python
from typing import Optional

async def get_user_by_id(self, user_id: int | str) -> Optional[User]:
    """Get a user by ID."""
    pass
```

### 2. Dataclasses

```python
from dataclasses import dataclass

@dataclass
class SearchResult:
    source: str
    title: str
    content: str
    relevance_score: float
    url: Optional[str] = None
```

### 3. Abstract Base Classes

```python
from abc import ABC, abstractmethod

class IDataSource(ABC):
    @abstractmethod
    async def search(self, query: str) -> list[SearchResult]:
        pass
```

### 4. Async Context Managers

```python
async with aiofiles.open(self.file_path, 'r') as f:
    data = await f.read()
```

### 5. Asyncio Gather

```python
# Execute searches in parallel
results = await asyncio.gather(*[
    source.search(query) for source in sources
])
```

## Key Differences from TypeScript

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Type System | Interfaces | Abstract Base Classes |
| Async | `Promise<T>` | `async def` / `await` |
| Data Structures | Classes | Dataclasses |
| File I/O | `fs/promises` | `aiofiles` |
| JSON | `JSON.parse()` | `json.loads()` |
| Parallel Execution | `Promise.all()` | `asyncio.gather()` |
| Environment | `process.env` | `os.getenv()` |

## Adding New Data Sources

### 1. Create Data Source Class

```python
# python/datasources/notion_datasource.py
from datasources.interfaces import IDataSource, SearchResult

class NotionDataSource(IDataSource):
    def __init__(self, token: str):
        self.token = token
    
    @property
    def name(self) -> str:
        return "Notion"
    
    async def connect(self) -> None:
        # Setup Notion client
        pass
    
    async def disconnect(self) -> None:
        # Cleanup
        pass
    
    def is_relevant_for(self, query: str) -> bool:
        return 'notion' in query.lower()
    
    async def search(self, query: str) -> list[SearchResult]:
        # Implement search
        return []
```

### 2. Add to Server

```python
# python/server_two.py
from datasources.notion_datasource import NotionDataSource

if os.getenv('NOTION_TOKEN'):
    search_data_sources.append(
        NotionDataSource(os.getenv('NOTION_TOKEN'))
    )
```

### 3. Update Requirements

```txt
# python/requirements.txt
notion-client>=2.0.0
```

## Testing

### Unit Tests

```python
import pytest
from datasources.json_datasource import JSONDataSource
from types import CreateUserDTO

@pytest.mark.asyncio
async def test_create_user():
    ds = JSONDataSource('./test_users.json')
    await ds.connect()
    
    user = CreateUserDTO(
        name="Test User",
        email="test@example.com",
        address="123 Test St",
        phone="555-0000"
    )
    
    user_id = await ds.create_user(user)
    assert user_id > 0
    
    # Cleanup
    await ds.delete_user(user_id)
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_multi_source_search():
    sources = [JSONDataSource('./test_users.json')]
    orchestrator = QueryOrchestrator(sources)
    
    results = await orchestrator.search("test query")
    assert isinstance(results, list)
```

## Performance Considerations

### 1. Connection Pooling

```python
# For PostgreSQL
import asyncpg

class PostgreSQLDataSource:
    async def connect(self):
        self.pool = await asyncpg.create_pool(
            host=self.host,
            database=self.database,
            user=self.user,
            password=self.password,
            min_size=5,
            max_size=20
        )
```

### 2. Caching

```python
from functools import lru_cache
from datetime import datetime, timedelta

class CachedDataSource:
    def __init__(self):
        self._cache = {}
        self._cache_ttl = timedelta(minutes=5)
    
    async def search(self, query: str):
        cache_key = f"search:{query}"
        
        if cache_key in self._cache:
            cached_time, results = self._cache[cache_key]
            if datetime.now() - cached_time < self._cache_ttl:
                return results
        
        results = await self._do_search(query)
        self._cache[cache_key] = (datetime.now(), results)
        return results
```

### 3. Rate Limiting

```python
import asyncio
from collections import deque
from datetime import datetime

class RateLimiter:
    def __init__(self, max_calls: int, period: float):
        self.max_calls = max_calls
        self.period = period
        self.calls = deque()
    
    async def acquire(self):
        now = datetime.now().timestamp()
        
        # Remove old calls
        while self.calls and self.calls[0] < now - self.period:
            self.calls.popleft()
        
        # Wait if limit reached
        if len(self.calls) >= self.max_calls:
            sleep_time = self.calls[0] + self.period - now
            await asyncio.sleep(sleep_time)
        
        self.calls.append(now)
```

## Deployment

### Docker

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY python/ .

CMD ["python", "server_two.py"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - DATA_SOURCE=postgres
      - POSTGRES_HOST=db
      - POSTGRES_DB=mcp_users
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=mcp_users
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Troubleshooting

### Issue: Import errors
**Solution**: Ensure you're running from the correct directory and virtual environment is activated

### Issue: Async runtime errors
**Solution**: Ensure all data source methods are `async` and called with `await`

### Issue: Type hint errors
**Solution**: Use Python 3.10+ for modern type hints (`list[User]` instead of `List[User]`)

### Issue: aiofiles not found
**Solution**: `pip install aiofiles`

## Best Practices

1. **Always use async/await** for I/O operations
2. **Use type hints** for better IDE support and documentation
3. **Handle exceptions** in all async methods
4. **Close connections** properly with `disconnect()` methods
5. **Use dataclasses** for simple data structures
6. **Test with pytest-asyncio** for async tests
7. **Use connection pooling** for database connections
8. **Implement caching** for frequently accessed data

## Comparison with TypeScript

### Advantages of Python Implementation

✅ Simpler syntax for beginners
✅ Rich data science ecosystem
✅ Better for ML/AI integrations
✅ Great async support with `asyncio`
✅ Dynamic typing (when preferred)

### Advantages of TypeScript Implementation

✅ Better type safety
✅ Better IDE autocomplete
✅ Faster execution (Node.js)
✅ Better for web integrations
✅ More mature MCP ecosystem

## Resources

- [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [Slack SDK Python](https://slack.dev/python-slack-sdk/)
- [Google APIs Python](https://github.com/googleapis/google-api-python-client)
- [psycopg2 Documentation](https://www.psycopg.org/docs/)
- [PyMongo Documentation](https://pymongo.readthedocs.io/)

## License

MIT
