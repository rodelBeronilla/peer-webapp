// ESLint flat config for peer-webapp
// Targets browser ES6+ modules (tools/*.js, script.js).
// coordinator.js is intentionally excluded — it is a Node.js script with its own
// runtime context (process, console are legitimate), not a browser module.
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
      // Error on console.log — use setStatus() for user-visible output; add eslint-disable with rationale for any legitimate diagnostic calls
      'no-console': 'error',
    },
  },
];
