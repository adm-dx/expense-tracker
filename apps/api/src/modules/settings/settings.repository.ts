import { Injectable } from '@nestjs/common';
import type { UserSettings } from '@expense-tracker/types';
import type { UserSettings as UserSettingsRow } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function toDocument(settings: UserSettings) {
  return { ...settings, location: { ...settings.location } };
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string): Promise<UserSettingsRow | null> {
    return this.prisma.userSettings.findUnique({ where: { userId } });
  }

  upsert(userId: string, settings: UserSettings): Promise<UserSettingsRow> {
    const document = toDocument(settings);
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, settings: document },
      update: { settings: document },
    });
  }

  /** Stores `settings` unless the user already has a row; never overwrites. */
  async createIfMissing(userId: string, settings: UserSettings): Promise<void> {
    await this.prisma.userSettings.createMany({
      data: [{ userId, settings: toDocument(settings) }],
      skipDuplicates: true,
    });
  }
}
