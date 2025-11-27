import { google } from 'googleapis';
import { IDataSource, SearchResult } from './interfaces/IDataSource.js';

export class GoogleDocsDataSource implements IDataSource {
  name = 'Google Docs';
  private drive: any;
  private docs: any;
  private isConnected = false;

  constructor(private credentials: any) {}

  async connect(): Promise<void> {
    const auth = new google.auth.GoogleAuth({
      credentials: this.credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.docs = google.docs({ version: 'v1', auth });
    this.isConnected = true;
    console.log('Google Docs connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  isRelevantFor(query: string): boolean {
    const keywords = ['document', 'doc', 'documentation', 'guide', 'spec', 'design', 'google'];
    return keywords.some(kw => query.toLowerCase().includes(kw));
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await this.drive.files.list({
        q: `fullText contains '${query}' and mimeType='application/vnd.google-apps.document'`,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        pageSize: 10,
      });

      const files = response.data.files || [];
      
      return Promise.all(
        files.map(async (file: any, index: number) => {
          let snippet = '';
          try {
            const doc = await this.docs.documents.get({ documentId: file.id });
            const content = this.extractText(doc.data);
            snippet = this.getSnippet(content, query);
          } catch (e) {
            snippet = 'Unable to fetch content';
          }

          return {
            source: 'Google Docs',
            title: file.name,
            content: snippet,
            url: file.webViewLink,
            relevanceScore: 1 - (index * 0.1),
            metadata: {
              lastModified: file.modifiedTime,
              documentId: file.id,
            },
          };
        })
      );
    } catch (error) {
      console.error('Google Docs search error:', error);
      return [];
    }
  }

  private extractText(doc: any): string {
    let text = '';
    const content = doc.body?.content || [];
    
    for (const element of content) {
      if (element.paragraph?.elements) {
        for (const elem of element.paragraph.elements) {
          text += elem.textRun?.content || '';
        }
      }
    }
    
    return text;
  }

  private getSnippet(text: string, query: string, contextLength = 100): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text.substring(0, contextLength) + '...';
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + query.length + contextLength / 2);
    
    return '...' + text.substring(start, end) + '...';
  }
}
