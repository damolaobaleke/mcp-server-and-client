"""Query orchestrator for multi-source searches."""

import asyncio
from typing import Callable, Optional
from dataclasses import dataclass
from ..datasources.interfaces import IDataSource, SearchResult


@dataclass
class SearchProgress:
    """Search progress information."""
    source: str
    status: str  # 'searching', 'completed', 'error'
    result_count: Optional[int] = None


class QueryOrchestrator:
    """Orchestrates searches across multiple data sources."""
    
    def __init__(self, data_sources: list[IDataSource]):
        """Initialize query orchestrator."""
        self.data_sources = data_sources
    
    async def search(
        self,
        query: str,
        on_progress: Optional[Callable[[SearchProgress], None]] = None
    ) -> list[SearchResult]:
        """
        Perform intelligent multi-source search.
        
        Args:
            query: Search query string
            on_progress: Optional callback for progress updates
            
        Returns:
            List of search results ranked by relevance
        """
        # Determine which sources are relevant
        relevant_sources = [ds for ds in self.data_sources if ds.is_relevant_for(query)]
        
        # If no specific sources match, use all sources
        sources_to_search = relevant_sources if relevant_sources else self.data_sources
        
        print(f"Searching across: {', '.join(s.name for s in sources_to_search)}")
        
        # Search all relevant sources in parallel
        async def search_source(source: IDataSource) -> list[SearchResult]:
            if on_progress:
                on_progress(SearchProgress(source=source.name, status='searching'))
            
            try:
                results = await source.search(query)
                
                if on_progress:
                    on_progress(SearchProgress(
                        source=source.name,
                        status='completed',
                        result_count=len(results)
                    ))
                
                return results
            except Exception as e:
                print(f"Error searching {source.name}: {e}")
                
                if on_progress:
                    on_progress(SearchProgress(source=source.name, status='error'))
                
                return []
        
        # Execute searches in parallel
        search_tasks = [search_source(source) for source in sources_to_search]
        all_results = await asyncio.gather(*search_tasks)
        
        # Flatten and sort by relevance
        flat_results = [result for results in all_results for result in results]
        sorted_results = self._rank_results(flat_results, query)
        
        return sorted_results
    
    def _rank_results(self, results: list[SearchResult], query: str) -> list[SearchResult]:
        """Rank and deduplicate results."""
        # Sort by relevance score
        sorted_results = sorted(results, key=lambda r: r.relevance_score, reverse=True)
        
        # Remove duplicates based on title and source
        unique_results = []
        seen = set()
        
        for result in sorted_results:
            key = f"{result.title}-{result.source}"
            if key not in seen:
                seen.add(key)
                unique_results.append(result)
        
        return unique_results
    
    def format_results(self, results: list[SearchResult], max_results: int = 10) -> str:
        """Get a formatted summary of search results."""
        if not results:
            return "No results found across any data sources."
        
        top_results = results[:max_results]
        source_groups = self._group_by_source(top_results)
        
        formatted = f"Found {len(results)} results across {len(source_groups)} sources:\n\n"
        
        for source, items in source_groups.items():
            formatted += f"**{source}** ({len(items)} results):\n"
            for item in items:
                formatted += f"- **{item.title}**\n"
                formatted += f"  {item.content}\n"
                if item.url:
                    formatted += f"  {item.url}\n"
                formatted += "\n"
        
        return formatted
    
    def _group_by_source(self, results: list[SearchResult]) -> dict[str, list[SearchResult]]:
        """Group results by source."""
        groups = {}
        for result in results:
            if result.source not in groups:
                groups[result.source] = []
            groups[result.source].append(result)
        return groups
