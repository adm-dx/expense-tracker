import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  updateTokenHash(id: string, tokenHash: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { tokenHash },
    });
  }

  revoke(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Removes every refresh token of the user. Unlike revoking, a deleted
   * token is simply unknown when used, so it doesn't look like a replayed
   * one and doesn't trigger `revokeAllForUser` on the tokens issued after.
   */
  deleteAllForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  revokeAllForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
