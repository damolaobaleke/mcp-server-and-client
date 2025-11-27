"""Slack data source implementation."""

from slack_sdk.web.async_client import AsyncWebClient
from .interfaces import IDataSource, SearchResult


class SlackDataSource(IDataSource):
    """Slack data source for searching messages and conversations."""
    
    def __init__(self, token: str):
        """Initialize Slack data source."""
        self.client = AsyncWebClient(token=token)
        self._is_connected = False
    
    @property
    def name(self) -> str:
        """Get the name of the data source."""
        return "Slack"
    
    async def connect(self) -> None:
        """Connect to Slack."""
        try:
            await self.client.auth_test()
            self._is_connected = True
            print("Slack connected")
        except Exception as e:
            print(f"Slack connection failed: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Disconnect from Slack."""
        self._is_connected = False
    
    def is_relevant_for(self, query: str) -> bool:
        """Determine if Slack is relevant for the query."""
        keywords = ['said', 'mentioned', 'discussion', 'conversation', 'message', 'chat', 'slack']
        return any(kw in query.lower() for kw in keywords)
    
    async def search(self, query: str) -> list[SearchResult]:
        """Search Slack messages."""
        try:
            response = await self.client.search_messages(query=query, count=10)
            matches = response.get('messages', {}).get('matches', [])
            
            results = []
            for index, msg in enumerate(matches):
                channel_name = msg.get('channel', {}).get('name', 'unknown')
                results.append(SearchResult(
                    source="Slack",
                    title=f"Message in #{channel_name}",
                    content=msg.get('text', ''),
                    url=msg.get('permalink'),
                    relevance_score=1.0 - (index * 0.1),
                    metadata={
                        'user': msg.get('username'),
                        'timestamp': msg.get('ts'),
                        'channel': channel_name
                    }
                ))
            
            return results
        except Exception as e:
            print(f"Slack search error: {e}")
            return []
