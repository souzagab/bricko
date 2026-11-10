import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the build works at any path (GitHub Pages project sites, previews).
export default defineConfig({
  base: process.env.BASE ?? './',
  plugins: [svelte()],
  optimizeDeps: { exclude: ['manifold-3d'] },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
