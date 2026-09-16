import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    name: 'Jane',
    passwordHash: 'hashed-secret',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('UsersService', () => {
  let repository: jest.Mocked<UsersRepository>;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repository);
  });

  describe('create', () => {
    it('maps a P2002 unique constraint violation to ConflictException', async () => {
      repository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(
        service.create({
          name: 'Jane',
          email: 'jane@example.com',
          passwordHash: 'hashed-secret',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('normalizes the email before persisting', async () => {
      repository.create.mockResolvedValue(makeUser());

      await service.create({
        name: 'Jane',
        email: '  Jane@Example.com  ',
        passwordHash: 'hashed-secret',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
    });
  });

  describe('toPublic', () => {
    it('does not leak passwordHash', () => {
      const publicUser = service.toPublic(makeUser());

      expect(publicUser).not.toHaveProperty('passwordHash');
      expect(publicUser).toEqual({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        isActive: true,
        lastLoginAt: null,
        createdAt: makeUser().createdAt,
        updatedAt: makeUser().updatedAt,
      });
    });
  });
});
