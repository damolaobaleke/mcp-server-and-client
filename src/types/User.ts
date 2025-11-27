export interface User {
  id: number | string;
  name: string;
  email: string;
  address: string;
  phone: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  address: string;
  phone: string;
}
