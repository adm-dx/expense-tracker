import { Injectable } from '@nestjs/common';
import { Prisma, Tag } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(userId: string): Promise<Tag[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Tag | null> {
    return this.prisma.tag.findFirst({ where: { id, userId } });
  }

  create(data: Prisma.TagUncheckedCreateInput): Promise<Tag> {
    return this.prisma.tag.create({ data });
  }

  update(id: string, data: Prisma.TagUpdateInput): Promise<Tag> {
    return this.prisma.tag.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id } });
  }
}
