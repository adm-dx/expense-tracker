/**
 * @jest-environment node
 */
import { buildContentSecurityPolicy } from '@web/shared/config/security-headers';

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split('; ').map((directive) => {
      const [name = '', ...values] = directive.split(' ');
      return [name, values.join(' ')];
    })
  );
}

describe('buildContentSecurityPolicy', () => {
  const production = directives(
    buildContentSecurityPolicy({
      nonce: 'abc123',
      apiUrl: 'https://rmillerqa.tech/expense-tracker/api',
      isDev: false,
    })
  );

  it('runs only scripts that carry the nonce, and no eval', () => {
    expect(production['script-src']).toBe(
      "'self' 'nonce-abc123' 'strict-dynamic'"
    );
  });

  it('talks to the API origin, not just its path', () => {
    expect(production['connect-src']).toBe("'self' https://rmillerqa.tech");
  });

  it('forbids framing, plugins and foreign form targets', () => {
    expect(production).toMatchObject({
      'frame-ancestors': "'none'",
      'object-src': "'none'",
      'base-uri': "'self'",
      'form-action': "'self'",
    });
    expect(production).toHaveProperty('upgrade-insecure-requests');
  });

  it('allows eval in development, and plain HTTP with an HTTP API', () => {
    const dev = directives(
      buildContentSecurityPolicy({
        nonce: 'n',
        apiUrl: 'http://localhost:3001',
        isDev: true,
      })
    );

    expect(dev['script-src']).toContain("'unsafe-eval'");
    expect(dev['connect-src']).toBe("'self' http://localhost:3001");
    expect(dev).not.toHaveProperty('upgrade-insecure-requests');
  });
});
