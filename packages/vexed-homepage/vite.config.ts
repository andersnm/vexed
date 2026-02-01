import { defineConfig } from 'vite';

export default defineConfig({
  base: '/vexed/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  assetsInclude: ['**/*.md'],
});
