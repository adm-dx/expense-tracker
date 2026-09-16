import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { UserLoggedInEvent } from './contracts';
import { CreateUserCommand } from '../users/contracts';
import { CreateDefaultCategoriesCommand } from '../categories/contracts';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function makePublicUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    name: 'Jane',
    isActive: true,
    lastLoginAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

describe('AuthService', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let eventBus: jest.Mocked<EventBus>;
  let tokenService: jest.Mocked<TokenService>;
  let service: AuthService;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as unknown as jest.Mocked<CommandBus>;
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    eventBus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    tokenService = {
      issueTokens: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
      rotate: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;
    service = new AuthService(commandBus, queryBus, eventBus, tokenService);
  });

  describe('register', () => {
    it('creates the user with default categories and issues tokens', async () => {
      commandBus.execute
        .mockResolvedValueOnce(makePublicUser())
        .mockResolvedValueOnce(undefined);

      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'super-secret',
      });

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(
        CreateUserCommand,
      );
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        new CreateDefaultCategoriesCommand('user-1'),
      );
      expect(tokenService.issueTokens).toHaveBeenCalledWith(makePublicUser());
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: makePublicUser(),
      });
    });

    it('propagates ConflictException for a duplicate email', async () => {
      commandBus.execute.mockRejectedValue(
        new ConflictException('A user with this email already exists'),
      );

      await expect(
        service.register({
          name: 'Jane',
          email: 'jane@example.com',
          password: 'super-secret',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('logs in with valid credentials and publishes UserLoggedInEvent', async () => {
      const passwordHash = await bcrypt.hash('super-secret', 4);
      queryBus.execute
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'jane@example.com',
          passwordHash,
          isActive: true,
        })
        .mockResolvedValueOnce(makePublicUser());

      const result = await service.login({
        email: 'jane@example.com',
        password: 'super-secret',
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(UserLoggedInEvent),
      );
      expect(result.user).toEqual(makePublicUser());
      expect(result.accessToken).toBe('access');
    });

    it('rejects an incorrect password with UnauthorizedException', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      queryBus.execute.mockResolvedValueOnce({
        id: 'user-1',
        email: 'jane@example.com',
        passwordHash,
        isActive: true,
      });

      await expect(
        service.login({ email: 'jane@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with UnauthorizedException', async () => {
      queryBus.execute.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
});
