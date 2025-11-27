import { WebClient } from '@slack/web-api';
import { IDataSource, SearchResult } from './interfaces/IDataSource.js';

export class SlackDataSource implements IDataSource {
  name = 'Slack';
  private client: WebClient;
  private isConnected = false;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async connect(): Promise<void> {
    try {
      await this.client.auth.test();
      this.isConnected = true;
      console.log('Slack connected');
    } catch (error) {
      console.error('Slack connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  isRelevantFor(query: string): boolean {
    const keywords = ['said', 'mentioned', 'discussion', 'conversation', 'message', 'chat', 'slack'];
    return keywords.some(kw => query.toLowerCase().includes(kw));
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const result = await this.client.search.messages({
        query,
        count: 10,
      });

      const matches = result.messages?.matches || [];
      
      return matches.map((msg: any, index: number) => ({
        source: 'Slack',
        title: `Message in #${msg.channel?.name || 'unknown'}`,
        content: msg.text || '',
        url: msg.permalink,
        relevanceScore: 1 - (index * 0.1),
        metadata: {
          user: msg.username,
          timestamp: msg.ts,
          channel: msg.channel?.name,
        },
      }));
    } catch (error) {
      console.error('Slack search error:', error);
      return [];
    }
  }
}
