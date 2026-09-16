export interface PublicUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}
