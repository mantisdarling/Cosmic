import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  adapter: vercel(),
  site: 'https://cosmic-nu-ebon.vercel.app',
  vite: {
    plugins: [tailwindcss()],
    build: { sourcemap: false },
    optimizeDeps: {
      include: ['react', 'react-dom', '@xyflow/react', 'dagre'],
    },
  },
});
