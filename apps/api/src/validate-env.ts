/** Shorter than this, an HMAC secret can be guessed offline from one token. */
export const MIN_SECRET_LENGTH = 32;

/** Values from `.env.example` and the dev compose file: public, in the repo. */
const PLACEHOLDERS = ['change-me', 'dev_password'];

/**
 * `ConfigModule`'s `validate`: in production, refuses to start with the
 * example secrets, short ones, or one secret for both token kinds. The repo
 * is public, so a forgotten placeholder would let anyone sign tokens for any
 * user. Elsewhere it accepts anything, so `.env.example` works as is.
 */
export function validateEnv(
  config: Record<string, unknown>
): Record<string, unknown> {
  if (config.NODE_ENV !== 'production') return config;

  const problems: string[] = [];
  const access = config.JWT_ACCESS_SECRET;
  const refresh = config.JWT_REFRESH_SECRET;
  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', access],
    ['JWT_REFRESH_SECRET', refresh],
  ] as const) {
    if (typeof value !== 'string' || value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
    } else if (hasPlaceholder(value)) {
      problems.push(`${name} is the example value`);
    }
  }
  if (typeof access === 'string' && access === refresh) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl === 'string' && hasPlaceholder(databaseUrl)) {
    problems.push('DATABASE_URL uses the example password');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production:\n- ${problems.join('\n- ')}\n` +
        'Generate secrets with `openssl rand -hex 32` (docs/deploy.md).'
    );
  }
  return config;
}

function hasPlaceholder(value: string): boolean {
  return PLACEHOLDERS.some((placeholder) => value.includes(placeholder));
}
