import { Pool } from 'pg';
import { IDataSource, SearchResult } from './interfaces/IDataSource.js';

export class DatabaseDataSource implements IDataSource {
  name = 'Database';
  private pool: Pool;
  private isConnected = false;

  constructor(config: any) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    await this.pool.connect();
    this.isConnected = true;
    console.log('Database connected');
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
  }

  isRelevantFor(query: string): boolean {
    const keywords = ['users', 'data', 'count', 'how many', 'metrics', 'analytics', 'datadog', 'database'];
    return keywords.some(kw => query.toLowerCase().includes(kw));
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];

      // Example: Search for user-related data
      if (query.toLowerCase().includes('users')) {
        const userCount = await this.pool.query('SELECT COUNT(*) as count FROM users');
        results.push({
          source: 'Database',
          title: 'User Statistics',
          content: `Total users: ${userCount.rows[0].count}`,
          relevanceScore: 0.9,
          metadata: { type: 'count', table: 'users' },
        });
      }

      // Example: Search for Datadog-related data
      if (query.toLowerCase().includes('datadog')) {
        const datadogUsers = await this.pool.query(
          "SELECT COUNT(*) as count FROM users WHERE tools LIKE '%datadog%'"
        );
        results.push({
          source: 'Database',
          title: 'Datadog Users',
          content: `Users using Datadog: ${datadogUsers.rows[0].count}`,
          relevanceScore: 0.95,
          metadata: { type: 'filtered_count', tool: 'datadog' },
        });
      }

      // Generic text search across user data
      const textSearch = await this.pool.query(
        `SELECT id, name, email FROM users WHERE 
         name ILIKE $1 OR email ILIKE $1 OR address ILIKE $1 
         LIMIT 5`,
        [`%${query}%`]
      );

      textSearch.rows.forEach((row, index) => {
        results.push({
          source: 'Database',
          title: `User: ${row.name}`,
          content: `Email: ${row.email}`,
          relevanceScore: 0.7 - (index * 0.1),
          metadata: { userId: row.id },
        });
      });

      return results;
    } catch (error) {
      console.error('Database search error:', error);
      return [];
    }
  }
}
