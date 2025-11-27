import { PostgreSQLDataSource } from '../datasources/PostgreSQLDataSource.js';
import { MongoDBDataSource } from '../datasources/MongoDBDataSource.js';
import { JSONDataSource } from '../datasources/JSONDataSource.js';
import { IUserDataSource } from '../datasources/interfaces/IUserDataSource.js';

export type DataSourceType = 'postgres' | 'mongodb' | 'json';

export function createDataSource(type: DataSourceType): IUserDataSource {
  switch (type) {
    case 'postgres':
      return new PostgreSQLDataSource({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'mcp_users',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'password',
      });
    
    case 'mongodb':
      return new MongoDBDataSource(
        process.env.MONGODB_URI || 'mongodb://localhost:27017',
        process.env.MONGODB_DB || 'mcp_users'
      );
    
    case 'json':
      return new JSONDataSource('./src/data/users.json');
    
    default:
      throw new Error(`Unknown data source type: ${type}`);
  }
}
