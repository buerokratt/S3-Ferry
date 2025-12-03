import path from 'path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  plugins: [
    // This is required to build the test files with SWC
    swc.vite({
      // Explicitly set the module type to avoid inheriting this value from a `.swcrc` config file
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      // Ensure Vitest correctly resolves TypeScript path aliases
      src: path.resolve(__dirname, './src'),
    },
  },
});
