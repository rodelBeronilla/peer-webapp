// ESLint flat config for peer-webapp
// Targets browser ES6+ modules (tools/*.js, script.js).
// Rule set is intentionally minimal — catching real bugs, not style.

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
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
      // Warn on accidental console.log left in production code
      'no-console': 'warn',
    },
  },
];
