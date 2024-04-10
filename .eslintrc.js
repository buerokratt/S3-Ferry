module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'sort-export-all'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/naming-convention': [
      'warn',
      {
        selector: 'default',
        format: ['camelCase'],
      },
      {
        selector: ['enumMember', 'typeLike'],
        format: ['PascalCase'],
      },
      {
        selector: 'classProperty',
        modifiers: ['readonly'],
        format: ['camelCase', /* constants */ 'UPPER_CASE'],
      },
      {
        selector: 'function',
        format: ['camelCase', /* decorators */ 'PascalCase'],
      },
      {
        selector: ['objectLiteralProperty', 'typeProperty'],
        format: ['camelCase', /* dependencies */ 'PascalCase', 'snake_case', 'UPPER_CASE'],
      },
      {
        selector: 'objectLiteralProperty',
        modifiers: ['requiresQuotes'],
        format: null,
      },
      {
        selector: 'variable',
        modifiers: ['const'],
        format: ['camelCase', /* constants */ 'UPPER_CASE'],
      },
      {
        selector: 'variable',
        types: ['function'],
        format: ['camelCase', /* decorators */ 'PascalCase'],
      },
    ],
    'import/order': [
      'error',
      {
        'groups': ['builtin', 'external', ['parent', 'sibling'], 'index'],
        'newlines-between': 'always',
        'alphabetize': { order: 'asc', caseInsensitive: true },
      },
    ],
    'sort-export-all/sort-export-all': ['error', 'asc', { caseSensitive: false }],
    'sort-imports': [
      'error',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
      },
    ],
  },
};
