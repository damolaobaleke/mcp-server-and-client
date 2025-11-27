import axios from 'axios';
import { IDataSource, SearchResult } from './interfaces/IDataSource.js';

export class WebSearchDataSource implements IDataSource {
  name = 'Web';
  private apiKey: string;
  private isConnected = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    console.log('Web search ready');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  isRelevantFor(query: string): boolean {
    // Web search is always relevant as fallback
    return true;
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      // Example using Google Custom Search API
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.apiKey,
          cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
          q: query,
          num: 5,
        },
      });

      const items = response.data.items || [];
      
      return items.map((item: any, index: number) => ({
        source: 'Web',
        title: item.title,
        content: item.snippet,
        url: item.link,
        relevanceScore: 1 - (index * 0.15),
        metadata: {
          displayLink: item.displayLink,
        },
      }));
    } catch (error) {
      console.error('Web search error:', error);
      return [];
    }
  }
}
