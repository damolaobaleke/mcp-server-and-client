import { IUserDataSource } from '../datasources/interfaces/IUserDataSource.js';
import { User, CreateUserDTO } from '../types/User.js';

export class UserService {
  constructor(private dataSource: IUserDataSource) {}

  async getAllUsers(): Promise<User[]> {
    return this.dataSource.getAllUsers();
  }

  async getUserById(id: string | number): Promise<User | null> {
    return this.dataSource.getUserById(id);
  }

  async createUser(user: CreateUserDTO): Promise<string | number> {
    // Add validation logic here if needed
    return this.dataSource.createUser(user);
  }

  async updateUser(id: string | number, user: Partial<CreateUserDTO>): Promise<boolean> {
    return this.dataSource.updateUser(id, user);
  }

  async deleteUser(id: string | number): Promise<boolean> {
    return this.dataSource.deleteUser(id);
  }
}
