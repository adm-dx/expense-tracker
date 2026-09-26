import {
  transactionSchema,
  type TransactionFormValues,
} from '@web/features/transaction/upsert/model/schema';

const valid: TransactionFormValues = {
  type: 'EXPENSE',
  categoryId: 'cat-1',
  amount: '12.50',
  currency: 'RSD',
  date: '2026-09-16',
  description: 'Lunch',
};

function messagesFor(overrides: Partial<Record<string, unknown>>): string[] {
  const result = transactionSchema.safeParse({ ...valid, ...overrides });
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('transactionSchema', () => {
  it('accepts a complete, valid form', () => {
    expect(transactionSchema.safeParse(valid).success).toBe(true);
  });

  describe('amount', () => {
    it.each(['1', '0.5', '12.50', '9999999999.99'])('accepts %s', (amount) => {
      expect(transactionSchema.safeParse({ ...valid, amount }).success).toBe(
        true
      );
    });

    it('rejects an empty amount', () => {
      expect(messagesFor({ amount: '' })).toContain('Enter an amount');
    });

    it('rejects zero', () => {
      expect(messagesFor({ amount: '0' })).toContain(
        'Amount must be greater than 0'
      );
    });

    it.each(['-5', '1.234', '.5', '12,5', 'abc', '1e3'])(
      'rejects %s',
      (amount) => {
        expect(messagesFor({ amount })).toContain(
          'Use a positive number with up to 2 decimals'
        );
      }
    );

    it('rejects an amount above the API limit', () => {
      expect(messagesFor({ amount: '10000000000' })).toContain(
        'Amount is too large'
      );
    });
  });

  describe('currency', () => {
    it.each(['RSD', 'EUR', 'HUF'])('accepts %s', (currency) => {
      expect(transactionSchema.safeParse({ ...valid, currency }).success).toBe(
        true
      );
    });

    it('rejects an unsupported currency', () => {
      expect(
        transactionSchema.safeParse({ ...valid, currency: 'USD' }).success
      ).toBe(false);
    });
  });

  describe('category and type', () => {
    it('requires a category', () => {
      expect(messagesFor({ categoryId: '' })).toContain('Choose a category');
    });

    it('accepts income', () => {
      expect(
        transactionSchema.safeParse({ ...valid, type: 'INCOME' }).success
      ).toBe(true);
    });

    it('rejects an unknown type', () => {
      expect(
        transactionSchema.safeParse({ ...valid, type: 'TRANSFER' }).success
      ).toBe(false);
    });
  });

  describe('date', () => {
    it.each(['', '16.09.2026', '2026-9-1', 'tomorrow'])(
      'rejects "%s"',
      (date) => {
        expect(messagesFor({ date })).toContain('Choose a date');
      }
    );
  });

  describe('description', () => {
    it('is optional', () => {
      expect(
        transactionSchema.safeParse({ ...valid, description: '' }).success
      ).toBe(true);
    });

    it('trims surrounding whitespace', () => {
      const result = transactionSchema.safeParse({
        ...valid,
        description: '  Lunch  ',
      });

      expect(result.success && result.data.description).toBe('Lunch');
    });

    it('allows exactly 255 characters', () => {
      expect(
        transactionSchema.safeParse({ ...valid, description: 'a'.repeat(255) })
          .success
      ).toBe(true);
    });

    it('rejects 256 characters', () => {
      expect(messagesFor({ description: 'a'.repeat(256) })).toContain(
        'At most 255 characters'
      );
    });
  });
});
