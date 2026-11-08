import { MIN_SECRET_LENGTH, validateEnv } from '@api/validate-env';

const ACCESS = 'a'.repeat(MIN_SECRET_LENGTH);
const REFRESH = 'r'.repeat(MIN_SECRET_LENGTH);

function production(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: ACCESS,
    JWT_REFRESH_SECRET: REFRESH,
    DATABASE_URL: 'postgresql://expense_tracker:s3cret@localhost:5432/et',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepts long, distinct secrets in production', () => {
    const config = production();

    expect(validateEnv(config)).toBe(config);
  });

  it('accepts the example values outside production', () => {
    const config = {
      JWT_ACCESS_SECRET: 'change-me-access-secret',
      JWT_REFRESH_SECRET: 'change-me-refresh-secret',
      DATABASE_URL: 'postgresql://expense_tracker:dev_password@localhost/x',
    };

    expect(validateEnv(config)).toBe(config);
  });

  it.each([
    [
      'a missing secret',
      { JWT_ACCESS_SECRET: undefined },
      'JWT_ACCESS_SECRET must be at least',
    ],
    [
      'a short secret',
      { JWT_REFRESH_SECRET: 'short' },
      'JWT_REFRESH_SECRET must be at least',
    ],
    [
      'the example secret',
      { JWT_ACCESS_SECRET: `change-me-access-secret${'x'.repeat(10)}` },
      'JWT_ACCESS_SECRET is the example value',
    ],
    ['one secret for both', { JWT_REFRESH_SECRET: ACCESS }, 'must differ'],
    [
      'the example database password',
      {
        DATABASE_URL: 'postgresql://expense_tracker:dev_password@localhost/et',
      },
      'DATABASE_URL uses the example password',
    ],
  ])('refuses %s in production', (_, overrides, message) => {
    expect(() => validateEnv(production(overrides))).toThrow(message);
  });

  it('lists every problem at once', () => {
    expect(() =>
      validateEnv(
        production({ JWT_ACCESS_SECRET: 'x', JWT_REFRESH_SECRET: 'y' })
      )
    ).toThrow(/JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/);
  });
});
