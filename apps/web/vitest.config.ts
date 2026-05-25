import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@meta-crm/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@meta-crm/permissions': path.resolve(__dirname, '../../packages/permissions/src/index.ts'),
      '@meta-crm/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    passWithNoTests: true,
  },
});
