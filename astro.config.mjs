import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  site: 'https://cosmic-roadmap.pages.dev',
  vite: {
    plugins: [tailwindcss()],
    build: { sourcemap: false },
    optimizeDeps: {
      include: ['react', 'react-dom', '@xyflow/react', 'dagre'],
    },
  },
});
