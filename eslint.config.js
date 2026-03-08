// ESLint flat config for peer-webapp
// Rule set is intentionally minimal — catching real bugs, not style.

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  // Browser ES6+ modules: tools and the script entrypoint
  {
    files: ['tools/*.js', 'script.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Catch real bugs
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-implicit-globals': 'error',
      // Error on console.log — use setStatus() for user-visible output; add eslint-disable with rationale for any legitimate diagnostic calls
      'no-console': 'error',
    },
  },
  // Node.js coordinator script — separate config to allow process/console/Buffer globals
  // while retaining the dead-code rules (no-unused-vars, no-undef) that catch real bugs.
  {
    files: ['coordinator.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',        // console.log/warn/error are the coordinator's logging mechanism
      'no-empty': ['error', { allowEmptyCatch: true }], // bare catch {} is intentional for non-fatal failures
    },
  },
];
