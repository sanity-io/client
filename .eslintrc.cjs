module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
  },
  plugins: ['@typescript-eslint', 'simple-import-sort', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error', // use the Any alias instead
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'no-console': 'error',
    'no-shadow': 'error',
    'no-warning-comments': ['warn', {location: 'start', terms: ['todo', '@todo', 'fixme']}],
    'prettier/prettier': 'warn',
  },

  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: ['test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}
