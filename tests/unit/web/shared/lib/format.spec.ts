import {
  formatAmount,
  formatCurrency,
  formatDate,
  getInitials,
  toDateInputValue,
  toIsoDate,
  toIsoEndOfDay,
  todayDateInputValue,
} from '@web/shared/lib/format';

describe('formatAmount', () => {
  it('prefixes income with a plus sign', () => {
    expect(formatAmount('12.5', 'INCOME')).toBe('+12.50');
  });

  it('prefixes expenses with a real minus sign', () => {
    expect(formatAmount('12.5', 'EXPENSE')).toBe('−12.50');
  });

  it('groups thousands and rounds to two decimals', () => {
    expect(formatAmount('1234567.891', 'INCOME')).toBe('+1,234,567.89');
  });
});

describe('formatCurrency', () => {
  it('formats without a sign for positive amounts', () => {
    expect(formatCurrency('1234.5')).toBe('1,234.50');
  });

  it('keeps the sign of a negative balance', () => {
    expect(formatCurrency('-337.50')).toBe('-337.50');
  });

  it('formats zero', () => {
    expect(formatCurrency('0')).toBe('0.00');
  });
});

describe('formatDate', () => {
  it('reads the calendar day in UTC', () => {
    expect(formatDate('2026-09-30T00:00:00.000Z')).toBe('Sep 30, 2026');
  });

  it('does not roll a late-evening timestamp into the next day', () => {
    expect(formatDate('2026-09-30T23:59:59.999Z')).toBe('Sep 30, 2026');
  });
});

describe('date helpers', () => {
  it('toIsoDate pins the start of the day in UTC', () => {
    expect(toIsoDate('2026-09-16')).toBe('2026-09-16T00:00:00.000Z');
  });

  it('toIsoEndOfDay pins the last millisecond of the day in UTC', () => {
    expect(toIsoEndOfDay('2026-09-16')).toBe('2026-09-16T23:59:59.999Z');
  });

  it('an evening transaction on the last day falls inside the period bounds', () => {
    // Regression: the period end used to be sent as midnight, which silently
    // dropped everything later on the last day.
    const transaction = new Date('2026-09-30T18:45:00.000Z').getTime();

    expect(transaction).toBeLessThanOrEqual(
      new Date(toIsoEndOfDay('2026-09-30')).getTime()
    );
    expect(transaction).toBeGreaterThan(
      new Date(toIsoDate('2026-09-30')).getTime()
    );
  });

  it('toDateInputValue keeps only the date part', () => {
    expect(toDateInputValue('2026-09-16T18:45:00.000Z')).toBe('2026-09-16');
  });

  describe('todayDateInputValue', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('zero-pads month and day', () => {
      jest.useFakeTimers({ now: new Date(2026, 0, 5, 12) });

      expect(todayDateInputValue()).toBe('2026-01-05');
    });
  });
});

describe('getInitials', () => {
  it('takes the first letter of a single name', () => {
    expect(getInitials('ann')).toBe('A');
  });

  it('takes the first letters of the first two words', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('Ada King Lovelace')).toBe('AK');
  });

  it('ignores extra whitespace', () => {
    expect(getInitials('  ada   lovelace ')).toBe('AL');
  });
});
