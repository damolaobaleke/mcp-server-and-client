import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { IUserDataSource } from './interfaces/IUserDataSource.js';
import { User, CreateUserDTO } from '../types/User.js';

export class MongoDBDataSource implements IUserDataSource {
  private client: MongoClient;
  private db?: Db;
  private collection?: Collection;
  private isConnected: boolean = false;

  constructor(private uri: string, private dbName: string) {
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection('users');
      
      // Create indexes
      await this.collection.createIndex({ email: 1 }, { unique: true });
      
      this.isConnected = true;
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('MongoDB disconnected');
    }
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.collection) throw new Error('Not connected to MongoDB');
    
    const users = await this.collection.find({}).toArray();
    return users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
    }));
  }

  async getUserById(id: string | number): Promise<User | null> {
    if (!this.collection) throw new Error('Not connected to MongoDB');
    
    try {
      const user = await this.collection.findOne({ _id: new ObjectId(id.toString()) });
      if (!user) return null;
      
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        address: user.address,
        phone: user.phone,
      };
    } catch {
      return null;
    }
  }

  async createUser(user: CreateUserDTO): Promise<string> {
    if (!this.collection) throw new Error('Not connected to MongoDB');
    
    const result = await this.collection.insertOne(user);
    return result.insertedId.toString();
  }

  async updateUser(id: string | number, user: Partial<CreateUserDTO>): Promise<boolean> {
    if (!this.collection) throw new Error('Not connected to MongoDB');
    
    try {
      const result = await this.collection.updateOne(
        { _id: new ObjectId(id.toString()) },
        { $set: user }
      );
      return result.modifiedCount > 0;
    } catch {
      return false;
    }
  }

  async deleteUser(id: string | number): Promise<boolean> {
    if (!this.collection) throw new Error('Not connected to MongoDB');
    
    try {
      const result = await this.collection.deleteOne({ _id: new ObjectId(id.toString()) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }
}
