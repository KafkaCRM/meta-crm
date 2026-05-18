const parser = require('@typescript-eslint/parser');

module.exports = [
  {
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        experimentalDecorators: true,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-throw-literal': 'error',
    },
  },
];
