import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { PublicUser, UserCredentials } from './contracts';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findById(id: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findById(id);
    return user ? this.toPublic(user) : null;
  }

  async findByEmail(email: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findByEmail(
      this.normalizeEmail(email),
    );
    return user ? this.toPublic(user) : null;
  }

  async getCredentials(email: string): Promise<UserCredentials | null> {
    const user = await this.usersRepository.findByEmail(
      this.normalizeEmail(email),
    );
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
    };
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<PublicUser> {
    try {
      const user = await this.usersRepository.create({
        name: data.name,
        email: this.normalizeEmail(data.email),
        passwordHash: data.passwordHash,
      });
      return this.toPublic(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async markLoggedIn(id: string): Promise<void> {
    await this.usersRepository.updateLastLogin(id);
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
