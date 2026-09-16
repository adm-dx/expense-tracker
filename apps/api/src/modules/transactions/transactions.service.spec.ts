import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';

function makeTransaction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tx-1',
    userId: 'user-1',
    amount: new Prisma.Decimal('12.50'),
    type: TransactionType.EXPENSE,
    description: 'Lunch',
    date: new Date('2026-09-10T00:00:00.000Z'),
    categoryId: 'cat-1',
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Groceries',
    color: '#22C55E',
    icon: 'shopping-cart',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TransactionsService', () => {
  let repository: jest.Mocked<TransactionsRepository>;
  let service: TransactionsService;

  beforeEach(() => {
    repository = {
      findManyByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      findCategoryForUser: jest.fn(),
      findCategoriesByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      sumByTypeAndCategory: jest.fn(),
    } as unknown as jest.Mocked<TransactionsRepository>;
    service = new TransactionsService(repository);
  });

  describe('list', () => {
    it('passes parsed filters to the repository and hides userId', async () => {
      repository.findManyByUser.mockResolvedValue({
        items: [makeTransaction()],
        total: 1,
      } as never);

      const result = await service.list('user-1', {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        type: TransactionType.EXPENSE,
      });

      expect(repository.findManyByUser).toHaveBeenCalledWith(
        'user-1',
        {
          dateFrom: new Date('2026-09-01'),
          dateTo: new Date('2026-09-30'),
          type: TransactionType.EXPENSE,
        },
        { skip: 0, take: 10 }
      );
      expect(result.items[0]).not.toHaveProperty('userId');
      expect(result.items[0]?.amount).toBe('12.50');
    });

    it('defaults to the first page of 10 and echoes pagination', async () => {
      repository.findManyByUser.mockResolvedValue({
        items: [],
        total: 0,
      } as never);

      const result = await service.list('user-1', {});

      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('translates page and pageSize into skip and take', async () => {
      repository.findManyByUser.mockResolvedValue({
        items: [makeTransaction()],
        total: 45,
      } as never);

      const result = await service.list('user-1', { page: 3, pageSize: 20 });

      expect(repository.findManyByUser).toHaveBeenCalledWith(
        'user-1',
        {},
        { skip: 40, take: 20 }
      );
      expect(result).toMatchObject({ total: 45, page: 3, pageSize: 20 });
    });

    it('throws BadRequestException when dateFrom is after dateTo', async () => {
      await expect(
        service.list('user-1', { dateFrom: '2026-10-01', dateTo: '2026-09-01' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findManyByUser).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('throws NotFoundException for a missing or foreign transaction', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.get('user-2', 'tx-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(repository.findByIdForUser).toHaveBeenCalledWith('tx-1', 'user-2');
    });
  });

  describe('create', () => {
    it('throws NotFoundException for a foreign category', async () => {
      repository.findCategoryForUser.mockResolvedValue(null);

      await expect(
        service.create('user-2', {
          amount: 10,
          type: TransactionType.EXPENSE,
          date: '2026-09-10',
          categoryId: 'cat-1',
        })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('stores a decimal amount and a trimmed description', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);
      repository.create.mockResolvedValue(makeTransaction() as never);

      await service.create('user-1', {
        amount: 12.5,
        type: TransactionType.EXPENSE,
        description: '  Lunch ',
        date: '2026-09-10',
        categoryId: 'cat-1',
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: new Prisma.Decimal('12.50'),
        type: TransactionType.EXPENSE,
        description: 'Lunch',
        date: new Date('2026-09-10'),
        categoryId: 'cat-1',
      });
    });

    it('stores a blank description as null', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);
      repository.create.mockResolvedValue(makeTransaction() as never);

      await service.create('user-1', {
        amount: 1,
        type: TransactionType.INCOME,
        description: '   ',
        date: '2026-09-10',
        categoryId: 'cat-1',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null })
      );
    });

    it('maps a P2003 foreign key violation to NotFoundException', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);
      repository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: '6.19.3',
        })
      );

      await expect(
        service.create('user-1', {
          amount: 1,
          type: TransactionType.INCOME,
          date: '2026-09-10',
          categoryId: 'cat-1',
        })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException and does not update a foreign transaction', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(
        service.update('user-2', 'tx-1', { amount: 5 })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when moving to a foreign category', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);
      repository.findCategoryForUser.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'tx-1', { categoryId: 'cat-2' })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('only sends provided fields and clears description with null', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);
      repository.update.mockResolvedValue(makeTransaction() as never);

      await service.update('user-1', 'tx-1', {
        amount: 7,
        description: null,
      });

      expect(repository.findCategoryForUser).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('tx-1', {
        amount: new Prisma.Decimal('7.00'),
        description: null,
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException and does not delete a foreign transaction', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.remove('user-2', 'tx-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned transaction', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);

      await service.remove('user-1', 'tx-1');

      expect(repository.delete).toHaveBeenCalledWith('tx-1');
    });
  });

  describe('summary', () => {
    it('queries the UTC month range', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      await service.summary('user-1', 9, 2026);

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith(
        'user-1',
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-10-01T00:00:00.000Z')
      );
    });

    it('rolls December over to January of the next year', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      await service.summary('user-1', 12, 2026);

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith(
        'user-1',
        new Date('2026-12-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z')
      );
    });

    it('returns zero totals for an empty month', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      const result = await service.summary('user-1', 9, 2026);

      expect(repository.findCategoriesByIds).not.toHaveBeenCalled();
      expect(result).toEqual({
        month: 9,
        year: 2026,
        totalIncome: '0.00',
        totalExpense: '0.00',
        balance: '0.00',
        byCategory: [],
      });
    });

    it('sums totals without float errors and sorts categories by total', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-1',
          amount: new Prisma.Decimal('0.10'),
        },
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-2',
          amount: new Prisma.Decimal('0.20'),
        },
        {
          type: TransactionType.INCOME,
          categoryId: 'cat-3',
          amount: new Prisma.Decimal('1000.00'),
        },
      ]);
      repository.findCategoriesByIds.mockResolvedValue([
        makeCategory(),
        makeCategory({ id: 'cat-2', name: 'Transport' }),
        makeCategory({ id: 'cat-3', name: 'Salary' }),
      ] as never);

      const result = await service.summary('user-1', 9, 2026);

      expect(result.totalIncome).toBe('1000.00');
      expect(result.totalExpense).toBe('0.30');
      expect(result.balance).toBe('999.70');
      expect(result.byCategory.map((item) => item.name)).toEqual([
        'Salary',
        'Transport',
        'Groceries',
      ]);
      expect(result.byCategory[0]).toEqual({
        categoryId: 'cat-3',
        name: 'Salary',
        color: '#22C55E',
        icon: 'shopping-cart',
        type: TransactionType.INCOME,
        total: '1000.00',
      });
    });
  });
});
