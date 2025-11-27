import { IDataSource, SearchResult } from '../datasources/interfaces/IDataSource.js';

export interface SearchProgress {
  source: string;
  status: 'searching' | 'completed' | 'error';
  resultCount?: number;
}

export class QueryOrchestrator {
  constructor(private dataSources: IDataSource[]) {}

  /**
   * Perform intelligent multi-source search
   */
  async search(
    query: string,
    onProgress?: (progress: SearchProgress) => void
  ): Promise<SearchResult[]> {
    // Determine which sources are relevant
    const relevantSources = this.dataSources.filter(ds => ds.isRelevantFor(query));
    
    // If no specific sources match, use all sources
    const sourcesToSearch = relevantSources.length > 0 ? relevantSources : this.dataSources;

    console.log(`Searching across: ${sourcesToSearch.map(s => s.name).join(', ')}`);

    // Search all relevant sources in parallel
    const searchPromises = sourcesToSearch.map(async (source) => {
      if (onProgress) {
        onProgress({ source: source.name, status: 'searching' });
      }

      try {
        const results = await source.search(query);
        
        if (onProgress) {
          onProgress({ 
            source: source.name, 
            status: 'completed',
            resultCount: results.length 
          });
        }

        return results;
      } catch (error) {
        console.error(`Error searching ${source.name}:`, error);
        
        if (onProgress) {
          onProgress({ source: source.name, status: 'error' });
        }

        return [];
      }
    });

    // Wait for all searches to complete
    const allResults = await Promise.all(searchPromises);
    
    // Flatten and sort by relevance
    const flatResults = allResults.flat();
    const sortedResults = this.rankResults(flatResults, query);

    return sortedResults;
  }

  /**
   * Rank and deduplicate results
   */
  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    // Sort by relevance score
    const sorted = results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Remove duplicates based on content similarity
    const unique: SearchResult[] = [];
    const seen = new Set<string>();

    for (const result of sorted) {
      const key = `${result.title}-${result.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Get a formatted summary of search results
   */
  formatResults(results: SearchResult[], maxResults = 10): string {
    if (results.length === 0) {
      return 'No results found across any data sources.';
    }

    const topResults = results.slice(0, maxResults);
    const sourceGroups = this.groupBySource(topResults);

    let formatted = `Found ${results.length} results across ${Object.keys(sourceGroups).length} sources:\n\n`;

    for (const [source, items] of Object.entries(sourceGroups)) {
      formatted += `**${source}** (${items.length} results):\n`;
      for (const item of items) {
        formatted += `- **${item.title}**\n`;
        formatted += `  ${item.content}\n`;
        if (item.url) {
          formatted += `  ${item.url}\n`;
        }
        formatted += '\n';
      }
    }

    return formatted;
  }

  private groupBySource(results: SearchResult[]): Record<string, SearchResult[]> {
    return results.reduce((acc, result) => {
      if (!acc[result.source]) {
        acc[result.source] = [];
      }
      acc[result.source].push(result);
      return acc;
    }, {} as Record<string, SearchResult[]>);
  }
}
