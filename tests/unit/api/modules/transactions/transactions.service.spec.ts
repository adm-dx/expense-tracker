import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { Prisma, TransactionType } from '@api/generated/prisma/client';
import {
  ExchangeRatesSnapshot,
  GetExchangeRatesQuery,
} from '@api/modules/exchange-rates/contracts';
import { GetUserSettingsQuery } from '@api/modules/settings/contracts';
import { GetUserTagsQuery } from '@api/modules/tags/contracts';
import { TransactionsService } from '@api/modules/transactions/transactions.service';
import { TransactionsRepository } from '@api/modules/transactions/transactions.repository';

function makeTransaction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tx-1',
    userId: 'user-1',
    amount: new Prisma.Decimal('12.50'),
    currency: 'RSD',
    type: TransactionType.EXPENSE,
    description: 'Lunch',
    date: new Date('2026-09-10T00:00:00.000Z'),
    categoryId: 'cat-1',
    tagIds: [],
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

// 1 EUR = 117.5 RSD = 400 HUF.
const RATES: ExchangeRatesSnapshot = {
  base: 'EUR',
  date: new Date('2026-09-26T00:00:00.000Z'),
  rates: new Map([
    ['EUR', new Prisma.Decimal('1')],
    ['RSD', new Prisma.Decimal('117.5')],
    ['HUF', new Prisma.Decimal('400')],
  ]),
};

// The defaults plus RSD and HUF, the currencies these tests use.
const SETTINGS: UserSettings = {
  ...DEFAULT_USER_SETTINGS,
  currencies: ['EUR', 'RSD', 'HUF'],
};

const TAGS = [
  { id: 'tag-1', name: 'Trip' },
  { id: 'tag-2', name: 'Work' },
];

describe('TransactionsService', () => {
  let repository: jest.Mocked<TransactionsRepository>;
  let queryBus: { execute: jest.Mock };
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
      sumByTypeAndTag: jest.fn(),
      sumByMonthForTag: jest.fn(),
      countByCurrency: jest.fn(),
      convertCurrency: jest.fn(),
    } as unknown as jest.Mocked<TransactionsRepository>;
    queryBus = {
      execute: jest
        .fn()
        .mockImplementation((query: unknown) =>
          Promise.resolve(
            query instanceof GetUserSettingsQuery
              ? SETTINGS
              : query instanceof GetUserTagsQuery
                ? TAGS
                : RATES
          )
        ),
    };
    service = new TransactionsService(
      repository,
      queryBus as unknown as QueryBus
    );
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

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        currency: 'EUR',
        ratesDate: null,
      });
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
          currency: 'RSD',
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
        currency: 'EUR',
        type: TransactionType.EXPENSE,
        description: '  Lunch ',
        date: '2026-09-10',
        categoryId: 'cat-1',
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: new Prisma.Decimal('12.50'),
        currency: 'EUR',
        type: TransactionType.EXPENSE,
        description: 'Lunch',
        date: new Date('2026-09-10'),
        categoryId: 'cat-1',
        tagIds: [],
      });
    });

    it('stores tags the user owns', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);
      repository.create.mockResolvedValue(
        makeTransaction({ tagIds: ['tag-1'] }) as never
      );

      const result = await service.create('user-1', {
        amount: 1,
        currency: 'EUR',
        type: TransactionType.EXPENSE,
        date: '2026-09-10',
        categoryId: 'cat-1',
        tagIds: ['tag-1'],
      });

      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetUserTagsQuery('user-1')
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tagIds: ['tag-1'] })
      );
      expect(result.tagIds).toEqual(['tag-1']);
    });

    it('throws NotFoundException for a tag the user does not own', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);

      await expect(
        service.create('user-1', {
          amount: 1,
          currency: 'EUR',
          type: TransactionType.EXPENSE,
          date: '2026-09-10',
          categoryId: 'cat-1',
          tagIds: ['tag-of-someone-else'],
        })
      ).rejects.toThrow('Tag not found');
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('stores a blank description as null', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);
      repository.create.mockResolvedValue(makeTransaction() as never);

      await service.create('user-1', {
        amount: 1,
        currency: 'RSD',
        type: TransactionType.INCOME,
        description: '   ',
        date: '2026-09-10',
        categoryId: 'cat-1',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null })
      );
    });

    it('rejects a currency the user has not enabled', async () => {
      repository.findCategoryForUser.mockResolvedValue(makeCategory() as never);

      await expect(
        service.create('user-1', {
          amount: 1,
          currency: 'USD',
          type: TransactionType.INCOME,
          date: '2026-09-10',
          categoryId: 'cat-1',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetUserSettingsQuery('user-1')
      );
      expect(repository.create).not.toHaveBeenCalled();
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
          currency: 'RSD',
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
      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('tx-1', {
        amount: new Prisma.Decimal('7.00'),
        description: null,
      });
    });

    it('rejects moving to a currency the user has not enabled', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);

      await expect(
        service.update('user-1', 'tx-1', { currency: 'GBP' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('update tags', () => {
    it('clears the tags with an empty list without looking them up', async () => {
      repository.findByIdForUser.mockResolvedValue(
        makeTransaction({ tagIds: ['tag-1'] }) as never
      );
      repository.update.mockResolvedValue(makeTransaction() as never);

      await service.update('user-1', 'tx-1', { tagIds: [] });

      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('tx-1', { tagIds: [] });
    });

    it('rejects a foreign tag', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);

      await expect(
        service.update('user-1', 'tx-1', { tagIds: ['tag-9'] })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('reads anything but an array of strings as no tags', () => {
      expect(
        service.toPublic(makeTransaction({ tagIds: { bad: true } }) as never)
          .tagIds
      ).toEqual([]);
      expect(
        service.toPublic(makeTransaction({ tagIds: ['tag-1', 2] }) as never)
          .tagIds
      ).toEqual(['tag-1']);
    });
  });

  describe('convertCurrency', () => {
    it('converts with the day rates of both currencies', async () => {
      repository.countByCurrency.mockResolvedValue(2);
      repository.convertCurrency.mockResolvedValue(2);

      await expect(
        service.convertCurrency('user-1', 'EUR', 'RSD')
      ).resolves.toBe(2);
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetExchangeRatesQuery()
      );
      expect(repository.convertCurrency).toHaveBeenCalledWith(
        'user-1',
        'EUR',
        'RSD',
        new Prisma.Decimal('1'),
        new Prisma.Decimal('117.5')
      );
    });

    it('asks for no rates when there is nothing to convert', async () => {
      repository.countByCurrency.mockResolvedValue(0);

      await expect(
        service.convertCurrency('user-1', 'HUF', 'RSD')
      ).resolves.toBe(0);
      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(repository.convertCurrency).not.toHaveBeenCalled();
    });

    it('answers 503 without a rate for the currency', async () => {
      repository.countByCurrency.mockResolvedValue(1);

      await expect(
        service.convertCurrency('user-1', 'GBP', 'RSD')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.convertCurrency).not.toHaveBeenCalled();
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
    const SEPTEMBER = {
      dateFrom: new Date('2026-09-01T00:00:00.000Z'),
      dateTo: new Date('2026-09-30T23:59:59.999Z'),
    };

    it('turns month and year into an inclusive UTC month range', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      await service.summary('user-1', { month: 9, year: 2026 });

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith(
        'user-1',
        SEPTEMBER
      );
    });

    it('rolls December over to January of the next year', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      await service.summary('user-1', { month: 12, year: 2026 });

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith('user-1', {
        dateFrom: new Date('2026-12-01T00:00:00.000Z'),
        dateTo: new Date('2026-12-31T23:59:59.999Z'),
      });
    });

    it('uses an explicit dateFrom/dateTo range', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      const result = await service.summary('user-1', {
        dateFrom: '2026-09-01T00:00:00.000Z',
        dateTo: '2026-09-10T00:00:00.000Z',
      });

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith('user-1', {
        dateFrom: new Date('2026-09-01T00:00:00.000Z'),
        dateTo: new Date('2026-09-10T00:00:00.000Z'),
      });
      expect(result.dateFrom).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(result.dateTo).toEqual(new Date('2026-09-10T00:00:00.000Z'));
    });

    it('defaults to the current UTC month', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);
      jest.useFakeTimers().setSystemTime(new Date('2026-09-16T12:00:00.000Z'));

      try {
        await service.summary('user-1', {});
      } finally {
        jest.useRealTimers();
      }

      expect(repository.sumByTypeAndCategory).toHaveBeenCalledWith(
        'user-1',
        SEPTEMBER
      );
    });

    it('rejects month without year', async () => {
      await expect(
        service.summary('user-1', { month: 9 })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.sumByTypeAndCategory).not.toHaveBeenCalled();
    });

    it('rejects mixing month/year with a date range', async () => {
      await expect(
        service.summary('user-1', {
          month: 9,
          year: 2026,
          dateFrom: '2026-09-01T00:00:00.000Z',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.sumByTypeAndCategory).not.toHaveBeenCalled();
    });

    it('rejects a one-sided range', async () => {
      await expect(
        service.summary('user-1', { dateFrom: '2026-09-01T00:00:00.000Z' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.sumByTypeAndCategory).not.toHaveBeenCalled();
    });

    it('rejects dateFrom after dateTo', async () => {
      await expect(
        service.summary('user-1', {
          dateFrom: '2026-10-01T00:00:00.000Z',
          dateTo: '2026-09-01T00:00:00.000Z',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.sumByTypeAndCategory).not.toHaveBeenCalled();
    });

    it('returns zero totals for an empty period', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([]);

      const result = await service.summary('user-1', { month: 9, year: 2026 });

      expect(repository.findCategoriesByIds).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...SEPTEMBER,
        totalIncome: '0.00',
        totalExpense: '0.00',
        balance: '0.00',
        byCategory: [],
        currency: 'EUR',
        ratesDate: null,
      });
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('sums totals without float errors and sorts categories by total', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-1',
          currency: 'RSD',
          amount: new Prisma.Decimal('0.10'),
          count: 1,
        },
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-2',
          currency: 'RSD',
          amount: new Prisma.Decimal('0.20'),
          count: 1,
        },
        {
          type: TransactionType.INCOME,
          categoryId: 'cat-3',
          currency: 'RSD',
          amount: new Prisma.Decimal('1000.00'),
          count: 1,
        },
      ]);
      repository.findCategoriesByIds.mockResolvedValue([
        makeCategory(),
        makeCategory({ id: 'cat-2', name: 'Transport' }),
        makeCategory({ id: 'cat-3', name: 'Salary' }),
      ] as never);

      const result = await service.summary('user-1', {
        month: 9,
        year: 2026,
        currency: 'RSD',
      });

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
        count: 1,
      });
    });
  });

  describe('currency conversion', () => {
    it('lists a single-currency page without asking for rates', async () => {
      repository.findManyByUser.mockResolvedValue({
        items: [makeTransaction({ currency: 'EUR' })],
        total: 1,
      } as never);

      const result = await service.list('user-1', { currency: 'EUR' });

      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(result.items[0]?.convertedAmount).toBe('12.50');
      expect(result).toMatchObject({ currency: 'EUR', ratesDate: null });
    });

    it('converts every row of a mixed page and keeps the original amount', async () => {
      repository.findManyByUser.mockResolvedValue({
        items: [
          makeTransaction({
            id: 'tx-eur',
            amount: new Prisma.Decimal('10.00'),
            currency: 'EUR',
          }),
          makeTransaction({
            id: 'tx-huf',
            amount: new Prisma.Decimal('1000.00'),
            currency: 'HUF',
          }),
          makeTransaction({
            id: 'tx-rsd',
            amount: new Prisma.Decimal('50.00'),
            currency: 'RSD',
          }),
        ],
        total: 3,
      } as never);

      const result = await service.list('user-1', { currency: 'RSD' });

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetExchangeRatesQuery)
      );
      expect(
        result.items.map((item) => [
          item.amount,
          item.currency,
          item.convertedAmount,
        ])
      ).toEqual([
        ['10.00', 'EUR', '1175.00'],
        // 1000 HUF = 2.5 EUR = 293.75 RSD, a cross rate through EUR.
        ['1000.00', 'HUF', '293.75'],
        ['50.00', 'RSD', '50.00'],
      ]);
      expect(result).toMatchObject({
        currency: 'RSD',
        ratesDate: RATES.date,
      });
    });

    it('propagates an outage only when a conversion is needed', async () => {
      queryBus.execute.mockRejectedValue(new ServiceUnavailableException());
      repository.findManyByUser.mockResolvedValue({
        items: [makeTransaction({ currency: 'EUR' })],
        total: 1,
      } as never);

      await expect(
        service.list('user-1', { currency: 'RSD' })
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.list('user-1', { currency: 'EUR' })
      ).resolves.toMatchObject({ total: 1 });
    });

    it('updates the currency without touching the amount', async () => {
      repository.findByIdForUser.mockResolvedValue(makeTransaction() as never);
      repository.update.mockResolvedValue(
        makeTransaction({ currency: 'HUF' }) as never
      );

      const result = await service.update('user-1', 'tx-1', {
        currency: 'HUF',
      });

      expect(repository.update).toHaveBeenCalledWith('tx-1', {
        currency: 'HUF',
      });
      expect(result.currency).toBe('HUF');
    });

    it('converts summary groups and merges a category across currencies', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-1',
          currency: 'RSD',
          amount: new Prisma.Decimal('0.01'),
          count: 2,
        },
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-1',
          currency: 'HUF',
          amount: new Prisma.Decimal('0.01'),
          count: 3,
        },
        {
          type: TransactionType.EXPENSE,
          categoryId: 'cat-2',
          currency: 'HUF',
          amount: new Prisma.Decimal('0.01'),
          count: 1,
        },
        {
          type: TransactionType.INCOME,
          categoryId: 'cat-3',
          currency: 'RSD',
          amount: new Prisma.Decimal('2350.00'),
          count: 1,
        },
      ]);
      repository.findCategoriesByIds.mockResolvedValue([
        makeCategory(),
        makeCategory({ id: 'cat-2', name: 'Transport' }),
        makeCategory({ id: 'cat-3', name: 'Salary' }),
      ] as never);

      const result = await service.summary('user-1', {
        month: 9,
        year: 2026,
        currency: 'EUR',
      });

      expect(result.currency).toBe('EUR');
      expect(result.ratesDate).toEqual(RATES.date);
      expect(result.totalIncome).toBe('20.00');
      expect(
        result.byCategory.map((item) => [item.categoryId, item.type])
      ).toEqual([
        ['cat-3', TransactionType.INCOME],
        ['cat-1', TransactionType.EXPENSE],
        ['cat-2', TransactionType.EXPENSE],
      ]);
      // Counted per currency in SQL, added up per category here.
      expect(result.byCategory.map((item) => item.count)).toEqual([1, 5, 1]);
    });

    it('sums converted amounts before rounding', async () => {
      repository.sumByTypeAndCategory.mockResolvedValue(
        ['cat-1', 'cat-2', 'cat-3'].map((categoryId) => ({
          type: TransactionType.EXPENSE,
          categoryId,
          currency: 'RSD',
          amount: new Prisma.Decimal('0.60'),
          count: 1,
        }))
      );
      repository.findCategoriesByIds.mockResolvedValue([] as never);

      const result = await service.summary('user-1', {
        month: 9,
        year: 2026,
        currency: 'EUR',
      });

      // 1.80 / 117.5 = 0.0153… → 0.02, while each row alone rounds to 0.01.
      expect(result.totalExpense).toBe('0.02');
      expect(result.byCategory.map((item) => item.total)).toEqual([
        '0.01',
        '0.01',
        '0.01',
      ]);
    });
  });

  describe('tagSummary', () => {
    it('converts per currency, merges per tag and names the tags', async () => {
      repository.sumByTypeAndTag.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          tagId: 'tag-1',
          currency: 'RSD',
          amount: new Prisma.Decimal('1175.00'),
          count: 2,
        },
        {
          type: TransactionType.EXPENSE,
          tagId: 'tag-1',
          currency: 'EUR',
          amount: new Prisma.Decimal('5.00'),
          count: 1,
        },
        {
          type: TransactionType.EXPENSE,
          tagId: null,
          currency: 'EUR',
          amount: new Prisma.Decimal('3.00'),
          count: 1,
        },
        {
          type: TransactionType.INCOME,
          tagId: 'tag-2',
          currency: 'EUR',
          amount: new Prisma.Decimal('100.00'),
          count: 1,
        },
      ]);

      const result = await service.tagSummary('user-1', {
        dateFrom: '2026-09-01T00:00:00.000Z',
        dateTo: '2026-09-30T23:59:59.999Z',
        currency: 'EUR',
      });

      expect(repository.sumByTypeAndTag).toHaveBeenCalledWith('user-1', {
        dateFrom: new Date('2026-09-01T00:00:00.000Z'),
        dateTo: new Date('2026-09-30T23:59:59.999Z'),
      });
      expect(result.ratesDate).toEqual(RATES.date);
      expect(result.byTag).toEqual([
        {
          tagId: 'tag-2',
          name: 'Work',
          type: TransactionType.INCOME,
          total: '100.00',
          count: 1,
        },
        {
          tagId: 'tag-1',
          name: 'Trip',
          type: TransactionType.EXPENSE,
          total: '15.00',
          count: 3,
        },
        {
          tagId: null,
          name: null,
          type: TransactionType.EXPENSE,
          total: '3.00',
          count: 1,
        },
      ]);
    });

    it('puts a tag that no longer exists under no tag', async () => {
      repository.sumByTypeAndTag.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          tagId: 'deleted-tag',
          currency: 'EUR',
          amount: new Prisma.Decimal('2.00'),
          count: 1,
        },
        {
          type: TransactionType.EXPENSE,
          tagId: null,
          currency: 'EUR',
          amount: new Prisma.Decimal('3.00'),
          count: 1,
        },
      ]);

      const result = await service.tagSummary('user-1', { currency: 'EUR' });

      expect(result.ratesDate).toBeNull();
      expect(result.byTag).toEqual([
        {
          tagId: null,
          name: null,
          type: TransactionType.EXPENSE,
          total: '5.00',
          count: 2,
        },
      ]);
    });

    it('asks for neither tags nor rates for an untagged single-currency period', async () => {
      repository.sumByTypeAndTag.mockResolvedValue([
        {
          type: TransactionType.EXPENSE,
          tagId: null,
          currency: 'EUR',
          amount: new Prisma.Decimal('3.00'),
          count: 1,
        },
      ]);

      await service.tagSummary('user-1', { currency: 'EUR' });

      expect(queryBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('tagHistory', () => {
    it('converts per currency, merges per month and fills the months between', async () => {
      repository.sumByMonthForTag.mockResolvedValue([
        {
          month: '2026-07',
          type: TransactionType.EXPENSE,
          currency: 'RSD',
          amount: new Prisma.Decimal('1175.00'),
          count: 2,
        },
        {
          month: '2026-07',
          type: TransactionType.EXPENSE,
          currency: 'EUR',
          amount: new Prisma.Decimal('5.00'),
          count: 1,
        },
        {
          month: '2026-04',
          type: TransactionType.INCOME,
          currency: 'EUR',
          amount: new Prisma.Decimal('100.00'),
          count: 1,
        },
      ]);

      const result = await service.tagHistory('user-1', {
        tagId: 'tag-1',
        currency: 'EUR',
      });

      expect(repository.sumByMonthForTag).toHaveBeenCalledWith(
        'user-1',
        'tag-1'
      );
      expect(result).toMatchObject({
        tagId: 'tag-1',
        totalIncome: '100.00',
        totalExpense: '15.00',
        balance: '85.00',
        currency: 'EUR',
        ratesDate: RATES.date,
      });
      expect(result.byMonth).toEqual([
        {
          month: '2026-04',
          income: '100.00',
          expense: '0.00',
          incomeCount: 1,
          expenseCount: 0,
        },
        {
          month: '2026-05',
          income: '0.00',
          expense: '0.00',
          incomeCount: 0,
          expenseCount: 0,
        },
        {
          month: '2026-06',
          income: '0.00',
          expense: '0.00',
          incomeCount: 0,
          expenseCount: 0,
        },
        {
          month: '2026-07',
          income: '0.00',
          expense: '15.00',
          incomeCount: 0,
          expenseCount: 3,
        },
      ]);
    });

    it('fills the months across a new year', async () => {
      repository.sumByMonthForTag.mockResolvedValue(
        ['2025-11', '2026-02'].map((month) => ({
          month,
          type: TransactionType.EXPENSE,
          currency: 'EUR',
          amount: new Prisma.Decimal('1.00'),
          count: 1,
        }))
      );

      const result = await service.tagHistory('user-1', { tagId: 'tag-1' });

      expect(result.byMonth.map((month) => month.month)).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
      ]);
    });

    it('is empty for a tag without transactions, asking for no rates', async () => {
      repository.sumByMonthForTag.mockResolvedValue([]);

      const result = await service.tagHistory('user-1', { tagId: 'tag-1' });

      expect(result).toEqual({
        tagId: 'tag-1',
        totalIncome: '0.00',
        totalExpense: '0.00',
        balance: '0.00',
        byMonth: [],
        currency: 'EUR',
        ratesDate: null,
      });
      expect(queryBus.execute).not.toHaveBeenCalledWith(
        expect.any(GetExchangeRatesQuery)
      );
    });

    it("throws NotFoundException for a tag that isn't the caller's", async () => {
      await expect(
        service.tagHistory('user-1', { tagId: 'someone-elses' })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.sumByMonthForTag).not.toHaveBeenCalled();
    });
  });
});
