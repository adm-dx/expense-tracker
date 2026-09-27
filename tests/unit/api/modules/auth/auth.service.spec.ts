import {
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '@api/modules/auth/auth.service';
import { TokenService } from '@api/modules/auth/token.service';
import { UserLoggedInEvent } from '@api/modules/auth/contracts';
import {
  ChangeUserPasswordCommand,
  CreateUserCommand,
  GetUserByIdQuery,
  GetUserCredentialsByIdQuery,
} from '@api/modules/users/contracts';
import { CreateDefaultCategoriesCommand } from '@api/modules/categories/contracts';
import { CreateDefaultSettingsCommand } from '@api/modules/settings/contracts';

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
      revokeAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TokenService>;
    service = new AuthService(commandBus, queryBus, eventBus, tokenService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('creates the user with default categories and settings, and issues tokens', async () => {
      commandBus.execute
        .mockResolvedValueOnce(makePublicUser())
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'super-secret',
      });

      expect(commandBus.execute).toHaveBeenCalledTimes(3);
      expect(commandBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(
        CreateUserCommand
      );
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        new CreateDefaultCategoriesCommand('user-1')
      );
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        3,
        new CreateDefaultSettingsCommand('user-1')
      );
      expect(tokenService.issueTokens).toHaveBeenCalledWith(makePublicUser());
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: makePublicUser(),
      });
    });

    it('still registers when seeding default categories fails', async () => {
      // The service logs the failure; keep it out of the test output.
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      commandBus.execute
        .mockResolvedValueOnce(makePublicUser())
        .mockRejectedValueOnce(new Error('db is down'));

      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'super-secret',
      });

      expect(result.user).toEqual(makePublicUser());
      expect(result.accessToken).toBe('access');
      expect(Logger.prototype.error).toHaveBeenCalled();
      // One failed step does not skip the next one.
      expect(commandBus.execute).toHaveBeenLastCalledWith(
        new CreateDefaultSettingsCommand('user-1')
      );
    });

    it('still registers when seeding default settings fails', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      commandBus.execute
        .mockResolvedValueOnce(makePublicUser())
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('db is down'));

      const result = await service.register({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'super-secret',
      });

      expect(result.accessToken).toBe('access');
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to create default settings for user user-1',
        expect.any(String)
      );
    });

    it('propagates ConflictException for a duplicate email', async () => {
      commandBus.execute.mockRejectedValue(
        new ConflictException('A user with this email already exists')
      );

      await expect(
        service.register({
          name: 'Jane',
          email: 'jane@example.com',
          password: 'super-secret',
        })
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
        expect.any(UserLoggedInEvent)
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
        service.login({ email: 'jane@example.com', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with UnauthorizedException', async () => {
      queryBus.execute.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    async function credentials(password: string, isActive = true) {
      return {
        id: 'user-1',
        email: 'jane@example.com',
        passwordHash: await bcrypt.hash(password, 4),
        isActive,
      };
    }

    it('stores the new hash, signs out everywhere and issues new tokens', async () => {
      queryBus.execute
        .mockResolvedValueOnce(await credentials('old-password'))
        .mockResolvedValueOnce(makePublicUser());

      const tokens = await service.changePassword('user-1', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      expect(queryBus.execute).toHaveBeenNthCalledWith(
        1,
        new GetUserCredentialsByIdQuery('user-1')
      );
      const [command] = commandBus.execute.mock.calls[0]!;
      expect(command).toBeInstanceOf(ChangeUserPasswordCommand);
      const { userId, passwordHash } = command as ChangeUserPasswordCommand;
      expect(userId).toBe('user-1');
      await expect(bcrypt.compare('new-password', passwordHash)).resolves.toBe(
        true
      );
      expect(tokenService.revokeAll).toHaveBeenCalledWith('user-1');
      expect(queryBus.execute).toHaveBeenNthCalledWith(
        2,
        new GetUserByIdQuery('user-1')
      );
      // Revoked first, so the new refresh token survives.
      expect(tokenService.revokeAll.mock.invocationCallOrder[0]).toBeLessThan(
        tokenService.issueTokens.mock.invocationCallOrder[0]!
      );
      expect(tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    });

    it('rejects a wrong current password with 400, not 401', async () => {
      queryBus.execute.mockResolvedValueOnce(await credentials('old-password'));

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'guess',
          newPassword: 'new-password',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(tokenService.revokeAll).not.toHaveBeenCalled();
    });

    it('rejects a new password equal to the current one', async () => {
      queryBus.execute.mockResolvedValueOnce(await credentials('same-password'));

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'same-password',
          newPassword: 'same-password',
        })
      ).rejects.toThrow('New password must differ from the current one');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing user', null],
      ['a deactivated user', 'inactive'],
    ])('rejects %s with UnauthorizedException', async (_label, kind) => {
      queryBus.execute.mockResolvedValueOnce(
        kind === null ? null : await credentials('old-password', false)
      );

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'old-password',
          newPassword: 'new-password',
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });
});
