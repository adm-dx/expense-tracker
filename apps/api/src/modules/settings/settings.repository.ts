import { Injectable } from '@nestjs/common';
import type { UserSettings } from '@expense-tracker/types';
import type { UserSettings as UserSettingsRow } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string): Promise<UserSettingsRow | null> {
    return this.prisma.userSettings.findUnique({ where: { userId } });
  }

  upsert(userId: string, settings: UserSettings): Promise<UserSettingsRow> {
    const document = { ...settings, location: { ...settings.location } };
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, settings: document },
      update: { settings: document },
    });
  }

  /** A no-op when the user has never saved anything. */
  async delete(userId: string): Promise<void> {
    await this.prisma.userSettings.deleteMany({ where: { userId } });
  }
}
