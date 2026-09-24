import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite(), tsconfigPaths()],
  test: {
    globals: true,
    reporters: ['verbose'],
    setupFiles: ['./test/setup-e2e.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
