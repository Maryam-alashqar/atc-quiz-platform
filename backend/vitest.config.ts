import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [swc.vite(), tsconfigPaths()],
  test: {
    globals: true,
    reporters: ['verbose'],
    setupFiles: ['./test/setup-unit.ts'],
    root: './',
    include: ['**/*.spec.ts'],
  },
});
