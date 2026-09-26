import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CategoryWithCount, PublicCategory } from './types';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CATEGORY_COLORS, DEFAULT_CATEGORIES } from './default-categories';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async list(userId: string, search?: string): Promise<PublicCategory[]> {
    const term = search?.trim();
    const categories = await this.categoriesRepository.findManyByUser(
      userId,
      term || undefined
    );
    return categories.map((category) => this.toPublic(category));
  }

  async get(userId: string, id: string): Promise<PublicCategory> {
    return this.toPublic(await this.findOwned(userId, id));
  }

  async create(
    userId: string,
    dto: CreateCategoryDto
  ): Promise<PublicCategory> {
    const color = dto.color
      ? dto.color.toUpperCase()
      : await this.nextColor(userId);
    return this.withConflictHandling(async () => {
      const category = await this.categoriesRepository.create({
        userId,
        name: dto.name.trim(),
        color,
        icon: dto.icon,
      });
      return this.toPublic(category);
    });
  }

  async createDefaults(userId: string): Promise<void> {
    await this.categoriesRepository.createMany(
      DEFAULT_CATEGORIES.map((category) => ({ userId, ...category }))
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto
  ): Promise<PublicCategory> {
    await this.findOwned(userId, id);

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.icon !== undefined) data.icon = dto.icon;

    return this.withConflictHandling(async () => {
      const category = await this.categoriesRepository.update(id, data);
      return this.toPublic(category);
    });
  }

  /**
   * Deletes a category. With `reassignTo`, its transactions move to that
   * category first; without it, a category that has transactions is kept (409).
   */
  async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
    await this.findOwned(userId, id);
    if (reassignTo !== undefined) {
      if (reassignTo === id) {
        throw new BadRequestException(
          'Transactions cannot be moved to the category being deleted'
        );
      }
      await this.findOwned(userId, reassignTo);
    }
    try {
      if (reassignTo === undefined) {
        await this.categoriesRepository.delete(id);
      } else {
        await this.categoriesRepository.reassignAndDelete(
          id,
          reassignTo,
          userId
        );
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'Category has transactions and cannot be deleted'
        );
      }
      throw error;
    }
  }

  toPublic(category: CategoryWithCount): PublicCategory {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      transactionCount: category._count.transactions,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private async nextColor(userId: string): Promise<string> {
    const count = await this.categoriesRepository.countByUser(userId);
    return CATEGORY_COLORS[count % CATEGORY_COLORS.length] ?? '#64748B';
  }

  private async findOwned(
    userId: string,
    id: string
  ): Promise<CategoryWithCount> {
    const category = await this.categoriesRepository.findByIdForUser(
      id,
      userId
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async withConflictHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Category with this name already exists');
      }
      throw error;
    }
  }
}
