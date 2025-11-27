import fs from 'node:fs/promises';
import { IUserDataSource } from './interfaces/IUserDataSource.js';
import { User, CreateUserDTO } from '../types/User.js';

export class JSONDataSource implements IUserDataSource {
  constructor(private filePath: string) {}

  async connect(): Promise<void> {
    // Ensure file exists
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]', 'utf-8');
    }
    console.log('JSON DataSource ready');
  }

  async disconnect(): Promise<void> {
    console.log('JSON DataSource disconnected');
  }

  private async readUsers(): Promise<User[]> {
    const data = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(data);
  }

  private async writeUsers(users: User[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(users, null, 2));
  }

  async getAllUsers(): Promise<User[]> {
    return this.readUsers();
  }

  async getUserById(id: string | number): Promise<User | null> {
    const users = await this.readUsers();
    return users.find(u => u.id === id || u.id.toString() === id.toString()) || null;
  }

  async createUser(user: CreateUserDTO): Promise<number> {
    const users = await this.readUsers();
    const id = users.length > 0 ? Math.max(...users.map(u => Number(u.id))) + 1 : 1;
    
    users.push({ id, ...user });
    await this.writeUsers(users);
    
    return id;
  }

  async updateUser(id: string | number, user: Partial<CreateUserDTO>): Promise<boolean> {
    const users = await this.readUsers();
    const index = users.findIndex(u => u.id === id || u.id.toString() === id.toString());
    
    if (index === -1) return false;
    
    users[index] = { ...users[index], ...user };
    await this.writeUsers(users);
    
    return true;
  }

  async deleteUser(id: string | number): Promise<boolean> {
    const users = await this.readUsers();
    const filtered = users.filter(u => u.id !== id && u.id.toString() !== id.toString());
    
    if (filtered.length === users.length) return false;
    
    await this.writeUsers(filtered);
    return true;
  }
}
