import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { QueryBus } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import { TokenService } from './token.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makePublicUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    name: 'Jane',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TokenService', () => {
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let queryBus: jest.Mocked<QueryBus>;
  let service: TokenService;

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    configService = {
      getOrThrow: jest.fn((key: string) => CONFIG[key]),
    } as unknown as jest.Mocked<ConfigService>;
    refreshTokensRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    service = new TokenService(
      jwtService,
      configService,
      refreshTokensRepository,
      queryBus,
    );
  });

  describe('rotate', () => {
    it('revokes the old token and issues a fresh pair on success', async () => {
      const record = {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash('old-refresh-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      };
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'rt-1' });
      refreshTokensRepository.findById.mockResolvedValue(record);
      queryBus.execute.mockResolvedValue(makePublicUser());
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      refreshTokensRepository.create.mockResolvedValue({
        ...record,
        id: 'rt-2',
        tokenHash: '',
      });

      const result = await service.rotate('old-refresh-token');

      expect(refreshTokensRepository.revoke).toHaveBeenCalledWith('rt-1');
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('rejects an expired refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'rt-1' });
      refreshTokensRepository.findById.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash('old-refresh-token'),
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await expect(service.rotate('old-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a hash mismatch', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'rt-1' });
      refreshTokensRepository.findById.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash('a-different-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await expect(service.rotate('old-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('revokes all tokens for the user when reusing an already-revoked token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'rt-1' });
      refreshTokensRepository.findById.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash('old-refresh-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(service.rotate('old-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('revoke', () => {
    it('revokes the record matching the token jti', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'rt-1' });
      refreshTokensRepository.findById.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash('refresh-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await service.revoke('refresh-token');

      expect(refreshTokensRepository.revoke).toHaveBeenCalledWith('rt-1');
    });

    it('does nothing when the signature is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await service.revoke('garbage-token');

      expect(refreshTokensRepository.revoke).not.toHaveBeenCalled();
    });
  });
});
