import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {FlatCompat} from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

// eslint-disable-next-line no-redeclare
const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line no-redeclare
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  {
    ignores: ['**/dist', '**/umd', '**/coverage', 'runtimes/deno', 'runtimes/node'],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'simple-import-sort': simpleImportSort,
      prettier,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'commonjs',
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/member-delimiter-style': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'no-console': 'error',
      'no-shadow': 'error',

      'no-warning-comments': [
        'warn',
        {
          location: 'start',
          terms: ['todo', '@todo', 'fixme'],
        },
      ],

      'prettier/prettier': 'warn',
    },
  },
  {
    files: ['**/*.js'],

    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    files: ['test/**/*.ts', 'test-next/**/*.ts'],

    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
