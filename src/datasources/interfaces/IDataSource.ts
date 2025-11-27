export interface SearchResult {
  source: string;
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface IDataSource {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  search(query: string): Promise<SearchResult[]>;
  isRelevantFor(query: string): boolean;
}
