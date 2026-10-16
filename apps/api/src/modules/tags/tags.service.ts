import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Prisma, Tag } from '../../generated/prisma/client';
import {
  CountTransactionsByTagQuery,
  RemoveTagFromTransactionsCommand,
  type RemoveTagFromTransactionsResult,
  type TransactionCountByTag,
} from '../transactions/contracts';
import { PublicTag } from './types';
import { TagsRepository } from './tags.repository';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class TagsService {
  constructor(
    private readonly tagsRepository: TagsRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  async list(userId: string): Promise<PublicTag[]> {
    const [tags, counts] = await Promise.all([
      this.tagsRepository.findManyByUser(userId),
      this.countTransactions(userId),
    ]);
    return tags.map((tag) => this.toPublic(tag, counts));
  }

  async get(userId: string, id: string): Promise<PublicTag> {
    const tag = await this.findOwned(userId, id);
    return this.toPublic(tag, await this.countTransactions(userId));
  }

  async create(userId: string, dto: CreateTagDto): Promise<PublicTag> {
    return this.withConflictHandling(async () => {
      const tag = await this.tagsRepository.create({
        userId,
        name: dto.name.trim(),
      });
      return this.toPublic(tag, {});
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTagDto
  ): Promise<PublicTag> {
    await this.findOwned(userId, id);

    const data: Prisma.TagUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();

    const tag = await this.withConflictHandling(() =>
      this.tagsRepository.update(id, data)
    );
    return this.toPublic(tag, await this.countTransactions(userId));
  }

  /**
   * Deletes a tag. Unlike a category, a tag in use can always be deleted: it
   * is stripped from the transactions first.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.commandBus.execute<
      RemoveTagFromTransactionsCommand,
      RemoveTagFromTransactionsResult
    >(new RemoveTagFromTransactionsCommand(userId, id));
    await this.tagsRepository.delete(id);
  }

  private toPublic(tag: Tag, counts: TransactionCountByTag): PublicTag {
    return {
      id: tag.id,
      name: tag.name,
      transactionCount: counts[tag.id] ?? 0,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  private countTransactions(userId: string): Promise<TransactionCountByTag> {
    return this.queryBus.execute<
      CountTransactionsByTagQuery,
      TransactionCountByTag
    >(new CountTransactionsByTagQuery(userId));
  }

  private async findOwned(userId: string, id: string): Promise<Tag> {
    const tag = await this.tagsRepository.findByIdForUser(id, userId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }

  private async withConflictHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Tag with this name already exists');
      }
      throw error;
    }
  }
}
