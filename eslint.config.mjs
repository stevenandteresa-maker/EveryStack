import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', '**/coverage/**'],
  },

  // Base: eslint recommended
  js.configs.recommended,

  // TypeScript recommended
  ...tseslint.configs.recommended,

  // Security — SAST basics (eslint-plugin-security recommended ruleset)
  // See: docs/reference/compliance.md § Vulnerability Management
  security.configs.recommended,

  // Disable detect-object-injection — extremely high false-positive rate
  // on standard bracket notation (obj[key]). All other security rules remain active.
  {
    rules: {
      'security/detect-object-injection': 'off',
    },
  },

  // Prettier (disables formatting rules)
  eslintConfigPrettier,

  // Global settings for all TS files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Browser globals for React/Next.js files
  {
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
