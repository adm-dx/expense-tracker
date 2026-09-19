import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PublicCategory } from './types';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DEFAULT_CATEGORIES } from './default-categories';

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
    return this.withConflictHandling(async () => {
      const category = await this.categoriesRepository.create({
        userId,
        name: dto.name.trim(),
        color: dto.color.toUpperCase(),
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
    if (dto.color !== undefined) data.color = dto.color.toUpperCase();
    if (dto.icon !== undefined) data.icon = dto.icon;

    return this.withConflictHandling(async () => {
      const category = await this.categoriesRepository.update(id, data);
      return this.toPublic(category);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    try {
      await this.categoriesRepository.delete(id);
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

  toPublic(category: Category): PublicCategory {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private async findOwned(userId: string, id: string): Promise<Category> {
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
