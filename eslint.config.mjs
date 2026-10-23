import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

const sharedRules = {
  'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-escape': 'warn',
  'no-prototype-builtins': 'off',
  'no-case-declarations': 'warn',
  'no-inner-declarations': 'off'
};

export default [
  {
    // LoadingBoardGS is a separate (git-ignored) Google Apps Script project.
    ignores: ['dist/**', 'dist-electron/**', 'build/**', 'coverage/**', 'node_modules/**', 'public/**', '**/*.min.js', 'LoadingBoardGS/**']
  },
  js.configs.recommended,

  // Electron main process, preload, build scripts
  {
    files: ['main.js', 'preload.js', 'main-process/**/*.js', 'scripts/**/*.js', 'config/**/*.js', '*.config.js', 'babel.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: sharedRules
  },
  {
    // preload runs with a DOM; the Agile scraper passes callbacks to page.evaluate() that run in Edge.
    files: ['preload.js', 'main-process/services/AgileScrapingService.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['vite.config.js'],
    languageOptions: { sourceType: 'module' }
  },

  // React renderer
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // A few renderer services are still CommonJS and probe `process` defensively.
      globals: { ...globals.browser, ...globals.commonjs, process: 'readonly' }
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...sharedRules,
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  // Tests
  {
    files: ['tests/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}', 'src/**/tests/**/*.{js,jsx}', 'src/setupTests.js', 'src/__mocks__/**'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.jest, ...globals.node, ...globals.browser }
    },
    rules: sharedRules
  },

  prettier
];
