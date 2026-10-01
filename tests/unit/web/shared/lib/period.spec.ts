import {
  formatPeriod,
  getPresetPeriod,
  PERIOD_PRESETS,
  restorePeriod,
} from '@web/shared/lib/period';

/** Pins "today" (local time) without touching timers. */
function setToday(year: number, monthIndex: number, day: number) {
  jest.useFakeTimers({ now: new Date(year, monthIndex, day, 12, 0, 0) });
}

describe('getPresetPeriod', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('this-month spans the whole current month', () => {
    setToday(2026, 8, 16);

    expect(getPresetPeriod('this-month')).toEqual({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });
  });

  it('last-month spans the whole previous month', () => {
    setToday(2026, 8, 16);

    expect(getPresetPeriod('last-month')).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('last-month in January rolls back into the previous year', () => {
    setToday(2026, 0, 15);

    expect(getPresetPeriod('last-month')).toEqual({
      dateFrom: '2025-12-01',
      dateTo: '2025-12-31',
    });
  });

  it('handles the last day of a leap-year February', () => {
    setToday(2028, 2, 10);

    expect(getPresetPeriod('last-month')).toEqual({
      dateFrom: '2028-02-01',
      dateTo: '2028-02-29',
    });
  });

  it('handles a non-leap February', () => {
    setToday(2026, 1, 10);

    expect(getPresetPeriod('this-month')).toEqual({
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });
  });

  it('last-30-days is 30 calendar days ending today, inclusive', () => {
    setToday(2026, 8, 16);

    expect(getPresetPeriod('last-30-days')).toEqual({
      dateFrom: '2026-08-18',
      dateTo: '2026-09-16',
    });
  });

  it('last-30-days crosses a year boundary', () => {
    setToday(2026, 0, 10);

    expect(getPresetPeriod('last-30-days')).toEqual({
      dateFrom: '2025-12-12',
      dateTo: '2026-01-10',
    });
  });

  it('this-year spans January 1 to December 31', () => {
    setToday(2026, 8, 16);

    expect(getPresetPeriod('this-year')).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
  });

  it('custom falls back to the current month', () => {
    setToday(2026, 8, 16);

    expect(getPresetPeriod('custom')).toEqual(getPresetPeriod('this-month'));
  });

  it('every preset yields an ordered range', () => {
    setToday(2026, 8, 16);

    for (const { value } of PERIOD_PRESETS) {
      const { dateFrom, dateTo } = getPresetPeriod(value);
      expect(dateFrom <= dateTo).toBe(true);
    }
  });
});

describe('formatPeriod', () => {
  it('shows both ends of a range', () => {
    expect(formatPeriod({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })).toBe(
      'Sep 1, 2026 – Sep 30, 2026'
    );
  });

  it('collapses a single-day range', () => {
    expect(formatPeriod({ dateFrom: '2026-09-16', dateTo: '2026-09-16' })).toBe(
      'Sep 16, 2026'
    );
  });
});

describe('restorePeriod', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('recomputes a stored preset from today, not from the day it was saved', () => {
    setToday(2026, 8, 16);

    // Saved in September, read back in... still September here, but the dates
    // stored back then are ignored either way.
    expect(
      restorePeriod({
        preset: 'last-month',
        period: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      })
    ).toEqual({
      preset: 'last-month',
      period: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
    });
  });

  it('keeps the dates of a custom range', () => {
    setToday(2026, 8, 16);

    expect(
      restorePeriod({
        preset: 'custom',
        period: { dateFrom: '2026-03-04', dateTo: '2026-05-06' },
      })
    ).toEqual({
      preset: 'custom',
      period: { dateFrom: '2026-03-04', dateTo: '2026-05-06' },
    });
  });

  it('falls back to this month without anything stored', () => {
    setToday(2026, 8, 16);

    expect(restorePeriod(undefined)).toEqual({
      preset: 'this-month',
      period: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    });
  });

  it('falls back to this month for an unknown preset', () => {
    setToday(2026, 8, 16);

    expect(restorePeriod({ preset: 'last-decade' })).toEqual({
      preset: 'this-month',
      period: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    });
  });

  it.each([
    ['a missing range', { preset: 'custom' }],
    [
      'a half-written range',
      { preset: 'custom', period: { dateFrom: '2026-03-04' } },
    ],
    [
      'a date that is not a date',
      {
        preset: 'custom',
        period: { dateFrom: 'yesterday', dateTo: '2026-03-04' },
      },
    ],
    [
      'a number instead of a date',
      {
        preset: 'custom',
        period: { dateFrom: 20260304, dateTo: '2026-03-04' },
      },
    ],
    [
      'an inverted range',
      {
        preset: 'custom',
        period: { dateFrom: '2026-05-06', dateTo: '2026-03-04' },
      },
    ],
  ])('falls back to this month for %s', (_label, stored) => {
    setToday(2026, 8, 16);

    expect(restorePeriod(stored)).toEqual({
      preset: 'this-month',
      period: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    });
  });
});
