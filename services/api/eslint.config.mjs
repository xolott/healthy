import { healthyEslintBase } from '@healthy/eslint-config';

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  ...healthyEslintBase(),
];
