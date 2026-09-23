import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(userId: string, search?: string): Promise<Category[]> {
    const where: Prisma.CategoryWhereInput = { userId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    return this.prisma.category.findMany({ where, orderBy: { name: 'asc' } });
  }

  findByIdForUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async createMany(
    data: Prisma.CategoryCreateManyInput[]
  ): Promise<void> {
    // skipDuplicates relies on the (userId, name) unique key, so reruns are no-ops.
    await this.prisma.category.createMany({ data, skipDuplicates: true });
  }

  update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}
