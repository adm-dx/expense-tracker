import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { QueryBus } from '@nestjs/cqrs';
import { createHash } from 'crypto';
import { GetUserByIdQuery, PublicUser } from '../users/contracts';
import { RefreshTokensRepository } from './refresh-tokens.repository';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;
const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseDurationMs(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  const [, amount = '0', unit = 'ms'] = match;
  return Number(amount) * (UNIT_TO_MS[unit] ?? 0);
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async issueTokens(user: PublicUser): Promise<AuthTokens> {
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiresIn));

    const record = await this.refreshTokensRepository.create({
      userId: user.id,
      tokenHash: '',
      expiresAt,
    });

    const accessToken = await this.signAccessToken(user.id, user.email);
    const refreshToken = await this.signRefreshToken(user.id, record.id);
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokensRepository.updateTokenHash(record.id, tokenHash);

    return { accessToken, refreshToken };
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const record = await this.refreshTokensRepository.findById(payload.jti);
    if (!record || record.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      await this.refreshTokensRepository.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (this.hashToken(refreshToken) !== record.tokenHash) {
      await this.refreshTokensRepository.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      PublicUser | null
    >(new GetUserByIdQuery(record.userId));
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokensRepository.revoke(record.id);
    return this.issueTokens(user);
  }

  async revoke(refreshToken: string): Promise<void> {
    let payload: { jti: string };
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    const record = await this.refreshTokensRepository.findById(payload.jti);
    if (!record || record.revokedAt) {
      return;
    }
    await this.refreshTokensRepository.revoke(record.id);
  }

  private signAccessToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ),
      },
    );
  }

  private signRefreshToken(userId: string, jti: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, jti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ),
      },
    );
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string; jti: string }> {
    try {
      return await this.jwtService.verifyAsync<{ sub: string; jti: string }>(
        refreshToken,
        { secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
