import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';

/**
 * Flat config for the API sources and the test suites. `apps/web` keeps its
 * own Next.js flat config (`apps/web/eslint.config.mjs`).
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'coverage/**',
      'apps/web/**',
      'packages/*/dist/**',
      'apps/api/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Jest configs are CommonJS scripts run by Node, not TypeScript modules.
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catches a forgotten `await` on an assertion or an API call, which
      // would otherwise make a test pass while its expectations never run.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      // A test that never asserts, or one left focused/skipped, is a silent
      // hole in the suite.
      'jest/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            '**.expect',
            // Local helpers that assert on a response.
            'expectRule',
            'expectStatus',
          ],
        },
      ],
      'jest/no-focused-tests': 'error',
      'jest/no-disabled-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/valid-expect': 'error',
      'jest/no-conditional-expect': 'error',
      // Test files legitimately reach into loosely typed response bodies.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // `jest.isolateModules` needs a synchronous require to reload a module.
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
