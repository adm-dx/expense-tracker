import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryWithCount } from './types';

const WITH_TRANSACTION_COUNT = {
  _count: { select: { transactions: true } },
} satisfies Prisma.CategoryInclude;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(
    userId: string,
    search?: string
  ): Promise<CategoryWithCount[]> {
    const where: Prisma.CategoryWhereInput = { userId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    return this.prisma.category.findMany({
      where,
      include: WITH_TRANSACTION_COUNT,
      orderBy: { name: 'asc' },
    });
  }

  findByIdForUser(
    id: string,
    userId: string
  ): Promise<CategoryWithCount | null> {
    return this.prisma.category.findFirst({
      where: { id, userId },
      include: WITH_TRANSACTION_COUNT,
    });
  }

  countByUser(userId: string): Promise<number> {
    return this.prisma.category.count({ where: { userId } });
  }

  create(
    data: Prisma.CategoryUncheckedCreateInput
  ): Promise<CategoryWithCount> {
    return this.prisma.category.create({
      data,
      include: WITH_TRANSACTION_COUNT,
    });
  }

  async createMany(data: Prisma.CategoryCreateManyInput[]): Promise<void> {
    // skipDuplicates relies on the (userId, name) unique key, so reruns are no-ops.
    await this.prisma.category.createMany({ data, skipDuplicates: true });
  }

  update(
    id: string,
    data: Prisma.CategoryUpdateInput
  ): Promise<CategoryWithCount> {
    return this.prisma.category.update({
      where: { id },
      data,
      include: WITH_TRANSACTION_COUNT,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  /** Moves the category's transactions to `toId` and deletes it, atomically. */
  async reassignAndDelete(
    fromId: string,
    toId: string,
    userId: string
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.transaction.updateMany({
        where: { categoryId: fromId, userId },
        data: { categoryId: toId },
      }),
      this.prisma.category.delete({ where: { id: fromId } }),
    ]);
  }
}
