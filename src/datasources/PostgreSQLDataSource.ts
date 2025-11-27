import { Pool } from 'pg';
import { IUserDataSource } from './interfaces/IUserDataSource.js';
import { User, CreateUserDTO } from '../types/User.js';

export class PostgreSQLDataSource implements IUserDataSource {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      const client = await this.pool.connect();
      
      // Create users table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          address TEXT,
          phone VARCHAR(50)
        )
      `);
      
      client.release();
      this.isConnected = true;
      console.log('PostgreSQL connected successfully');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      console.log('PostgreSQL disconnected');
    }
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.pool.query('SELECT * FROM users ORDER BY id');
    return result.rows;
  }

  async getUserById(id: string | number): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async createUser(user: CreateUserDTO): Promise<number> {
    const result = await this.pool.query(
      'INSERT INTO users (name, email, address, phone) VALUES ($1, $2, $3, $4) RETURNING id',
      [user.name, user.email, user.address, user.phone]
    );
    return result.rows[0].id;
  }

  async updateUser(id: string | number, user: Partial<CreateUserDTO>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (user.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(user.name);
    }
    if (user.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(user.email);
    }
    if (user.address !== undefined) {
      fields.push(`address = $${paramCount++}`);
      values.push(user.address);
    }
    if (user.phone !== undefined) {
      fields.push(`phone = $${paramCount++}`);
      values.push(user.phone);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const result = await this.pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteUser(id: string | number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
