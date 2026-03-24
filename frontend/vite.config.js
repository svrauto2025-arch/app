import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  server: {
    port: 5173,
    strictPort: true
  },
  esbuild: {
    jsx: 'automatic'
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
});
