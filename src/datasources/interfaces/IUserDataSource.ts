import { User, CreateUserDTO } from '../../types/User.js';

export interface IUserDataSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getUserById(id: string | number): Promise<User | null>;
  createUser(user: CreateUserDTO): Promise<string | number>;
  updateUser(id: string | number, user: Partial<CreateUserDTO>): Promise<boolean>;
  deleteUser(id: string | number): Promise<boolean>;
}
