import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@api/generated/prisma/client';
import { CategoriesService } from '@api/modules/categories/categories.service';
import { CategoriesRepository } from '@api/modules/categories/categories.repository';
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
} from '@api/modules/categories/default-categories';

function makeCategory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Groceries',
    color: '#22C55E',
    icon: 'shopping-cart',
    _count: { transactions: 0 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('CategoriesService', () => {
  let repository: jest.Mocked<CategoriesRepository>;
  let service: CategoriesService;

  beforeEach(() => {
    repository = {
      findManyByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      countByUser: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reassignAndDelete: jest.fn(),
    } as unknown as jest.Mocked<CategoriesRepository>;
    service = new CategoriesService(repository);
  });

  describe('list', () => {
    it('passes the trimmed search term to the repository', async () => {
      repository.findManyByUser.mockResolvedValue([makeCategory()] as never);

      const result = await service.list('user-1', '  groc ');

      expect(repository.findManyByUser).toHaveBeenCalledWith('user-1', 'groc');
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('userId');
      expect(result[0]).not.toHaveProperty('_count');
      expect(result[0]?.transactionCount).toBe(0);
    });

    it('ignores a blank search term', async () => {
      repository.findManyByUser.mockResolvedValue([]);

      await service.list('user-1', '   ');

      expect(repository.findManyByUser).toHaveBeenCalledWith(
        'user-1',
        undefined
      );
    });
  });

  describe('get', () => {
    it('throws NotFoundException for a missing or foreign category', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.get('user-2', 'cat-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(repository.findByIdForUser).toHaveBeenCalledWith(
        'cat-1',
        'user-2'
      );
    });
  });

  describe('create', () => {
    it('trims the name and normalizes the color', async () => {
      repository.create.mockResolvedValue(makeCategory() as never);

      await service.create('user-1', {
        name: '  Groceries ',
        color: '#22c55e',
        icon: 'shopping-cart',
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Groceries',
        color: '#22C55E',
        icon: 'shopping-cart',
      });
    });

    it('picks the next palette color when none is given', async () => {
      repository.countByUser.mockResolvedValue(CATEGORY_COLORS.length + 2);
      repository.create.mockResolvedValue(makeCategory() as never);

      await service.create('user-1', { name: 'Pets', icon: 'paw-print' });

      expect(repository.countByUser).toHaveBeenCalledWith('user-1');
      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Pets',
        color: CATEGORY_COLORS[2],
        icon: 'paw-print',
      });
    });

    it('maps a P2002 unique constraint violation to ConflictException', async () => {
      repository.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.create('user-1', {
          name: 'Groceries',
          color: '#22C55E',
          icon: 'shopping-cart',
        })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException and does not update a foreign category', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(
        service.update('user-2', 'cat-1', { name: 'Food' })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('only sends provided fields', async () => {
      repository.findByIdForUser.mockResolvedValue(makeCategory() as never);
      repository.update.mockResolvedValue(
        makeCategory({ name: 'Food' }) as never
      );

      await service.update('user-1', 'cat-1', { name: ' Food ' });

      expect(repository.update).toHaveBeenCalledWith('cat-1', { name: 'Food' });
    });

    it('maps a P2002 unique constraint violation to ConflictException', async () => {
      repository.findByIdForUser.mockResolvedValue(makeCategory() as never);
      repository.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update('user-1', 'cat-1', { name: 'Taken' })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createDefaults', () => {
    it('creates the default set for the user', async () => {
      repository.createMany.mockResolvedValue(undefined);

      await service.createDefaults('user-1');

      const [data] = repository.createMany.mock.calls[0] ?? [];
      expect(data).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(data?.every((c) => c.userId === 'user-1')).toBe(true);
      expect(data?.map((c) => c.name)).toEqual(
        DEFAULT_CATEGORIES.map((c) => c.name)
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException and does not delete a foreign category', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.remove('user-2', 'cat-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned category', async () => {
      repository.findByIdForUser.mockResolvedValue(makeCategory() as never);

      await service.remove('user-1', 'cat-1');

      expect(repository.delete).toHaveBeenCalledWith('cat-1');
    });

    it('maps a P2003 foreign key violation to ConflictException', async () => {
      repository.findByIdForUser.mockResolvedValue(makeCategory() as never);
      repository.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('has transactions', {
          code: 'P2003',
          clientVersion: '6.19.3',
        })
      );

      await expect(service.remove('user-1', 'cat-1')).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    describe('with reassignTo', () => {
      it('moves the transactions and deletes the category', async () => {
        repository.findByIdForUser.mockImplementation(
          async (id) => makeCategory({ id }) as never
        );

        await service.remove('user-1', 'cat-1', 'cat-2');

        expect(repository.findByIdForUser).toHaveBeenCalledWith(
          'cat-2',
          'user-1'
        );
        expect(repository.reassignAndDelete).toHaveBeenCalledWith(
          'cat-1',
          'cat-2',
          'user-1'
        );
        expect(repository.delete).not.toHaveBeenCalled();
      });

      it('throws NotFoundException for a missing or foreign target', async () => {
        repository.findByIdForUser.mockImplementation(async (id) =>
          id === 'cat-1' ? (makeCategory() as never) : null
        );

        await expect(
          service.remove('user-1', 'cat-1', 'cat-foreign')
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repository.reassignAndDelete).not.toHaveBeenCalled();
      });

      it('rejects moving the transactions into the category itself', async () => {
        repository.findByIdForUser.mockResolvedValue(makeCategory() as never);

        await expect(
          service.remove('user-1', 'cat-1', 'cat-1')
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.reassignAndDelete).not.toHaveBeenCalled();
      });
    });
  });
});
