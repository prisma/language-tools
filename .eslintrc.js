module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:prettier/recommended',
    'prettier/@typescript-eslint',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.base.json', './**/**/tsconfig.json']
  }
}
