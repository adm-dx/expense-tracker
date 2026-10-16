import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@api/generated/prisma/client';
import { TagsService } from '@api/modules/tags/tags.service';
import { TagsRepository } from '@api/modules/tags/tags.repository';
import {
  CountTransactionsByTagQuery,
  RemoveTagFromTransactionsCommand,
} from '@api/modules/transactions/contracts';

function makeTag(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tag-1',
    userId: 'user-1',
    name: 'Trip',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

describe('TagsService', () => {
  let repository: jest.Mocked<TagsRepository>;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let service: TagsService;

  beforeEach(() => {
    repository = {
      findManyByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TagsRepository>;
    commandBus = { execute: jest.fn().mockResolvedValue({ updated: 0 }) };
    queryBus = { execute: jest.fn().mockResolvedValue({ 'tag-1': 3 }) };
    service = new TagsService(
      repository,
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus
    );
  });

  describe('list', () => {
    it('adds the transaction count of each tag, 0 when it has none', async () => {
      repository.findManyByUser.mockResolvedValue([
        makeTag(),
        makeTag({ id: 'tag-2', name: 'Work' }),
      ] as never);

      const result = await service.list('user-1');

      expect(queryBus.execute).toHaveBeenCalledWith(
        new CountTransactionsByTagQuery('user-1')
      );
      expect(result.map((tag) => [tag.name, tag.transactionCount])).toEqual([
        ['Trip', 3],
        ['Work', 0],
      ]);
      expect(result[0]).not.toHaveProperty('userId');
    });
  });

  describe('create', () => {
    it('stores the trimmed name', async () => {
      repository.create.mockResolvedValue(makeTag() as never);

      const result = await service.create('user-1', { name: '  Trip ' });

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Trip',
      });
      expect(result.transactionCount).toBe(0);
    });

    it('maps a duplicate name to ConflictException', async () => {
      repository.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.create('user-1', { name: 'Trip' })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a foreign tag', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(
        service.update('user-2', 'tag-1', { name: 'X' })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findByIdForUser).toHaveBeenCalledWith(
        'tag-1',
        'user-2'
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('renames and maps a duplicate name to ConflictException', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTag() as never);
      repository.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update('user-1', 'tag-1', { name: ' Work ' })
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).toHaveBeenCalledWith('tag-1', {
        name: 'Work',
      });
    });
  });

  describe('remove', () => {
    it('strips the tag from the transactions, then deletes it', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTag() as never);
      const calls: string[] = [];
      commandBus.execute.mockImplementation(() => {
        calls.push('strip');
        return Promise.resolve({ updated: 2 });
      });
      repository.delete.mockImplementation(() => {
        calls.push('delete');
        return Promise.resolve();
      });

      await service.remove('user-1', 'tag-1');

      expect(commandBus.execute).toHaveBeenCalledWith(
        new RemoveTagFromTransactionsCommand('user-1', 'tag-1')
      );
      expect(repository.delete).toHaveBeenCalledWith('tag-1');
      expect(calls).toEqual(['strip', 'delete']);
    });

    it('touches nothing for a foreign tag', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.remove('user-2', 'tag-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
